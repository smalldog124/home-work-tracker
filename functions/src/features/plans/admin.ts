import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { paidPlanIdSchema } from '@home-work/shared';
import type { Context } from '../../lib/firebase-admin';
import { fail } from '../../lib/errors';
import { hash, teacherRef } from '../../lib/records';
import { getPlanSummary } from './service';
import { writePlanEvent } from './records';
import { generatePlanCode } from './code';

async function teacher(ctx: Context, email: string) {
  const auth = ctx.auth ?? getAuth();
  try { return await auth.getUserByEmail(z.email().parse(email)); }
  catch { fail('not-found', 'ไม่พบบัญชีครู กรุณาให้ครูเข้าสู่ระบบก่อน', 'TEACHER_NOT_FOUND'); }
}
export async function findTeacher(ctx: Context, input: { email: string }) {
  const user = await teacher(ctx, input.email);
  return { uid: user.uid, email: user.email!, ...await getPlanSummary(ctx, user.uid) };
}
export async function createPlanCode(ctx: Context, actorId: string, input: { email: string; planId: string }) {
  if (!actorId) fail('permission-denied', 'ต้องระบุตัวตนผู้ดูแลจาก credentials', 'ADMIN_IDENTITY_REQUIRED');
  const planId = paidPlanIdSchema.parse(input.planId);
  const user = await teacher(ctx, input.email);
  const now = ctx.now();
  const expiresAt = new Date(now.getTime() + 30 * 86400000);
  return ctx.db.runTransaction(async tx => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generatePlanCode();
      const codeId = hash(code);
      const ref = ctx.db.doc(`planCodes/${codeId}`);
      if ((await tx.get(ref)).exists) continue;
      tx.create(ref, { teacherUid: user.uid, planId, status: 'unused', createdAt: Timestamp.fromDate(now), expiresAt: Timestamp.fromDate(expiresAt), createdBy: actorId, usedAt: null, usedBy: null, cancelledAt: null, cancelledBy: null, resultPlanExpiresAt: null });
      writePlanEvent(tx, ctx, user.uid, { type: 'code-created', actorId, codeId, newPlanId: planId });
      return { codeId, code, teacherUid: user.uid, planId, expiresAt: expiresAt.toISOString() };
    }
    fail('resource-exhausted', 'สร้างโค้ดไม่สำเร็จ กรุณาลองใหม่', 'CODE_GENERATION_EXHAUSTED');
  });
}
export async function listPlanCodes(ctx: Context, input: { email: string }) {
  const user = await teacher(ctx, input.email);
  const codes = await ctx.db.collection('planCodes').where('teacherUid', '==', user.uid).orderBy('createdAt', 'desc').get();
  return codes.docs.map(doc => {
    const data = doc.data();
    return { codeId: doc.id, planId: data.planId as string, status: data.status === 'unused' && ctx.now().getTime() >= data.expiresAt.toMillis() ? 'expired' : data.status as string, createdAt: data.createdAt.toDate().toISOString() as string, expiresAt: data.expiresAt.toDate().toISOString() as string };
  });
}
export async function cancelPlanCode(ctx: Context, actorId: string, input: { codeId: string }) {
  if (!actorId) fail('permission-denied', 'ต้องระบุตัวตนผู้ดูแลจาก credentials', 'ADMIN_IDENTITY_REQUIRED');
  const codeId = z.string().regex(/^[a-f0-9]{64}$/).parse(input.codeId);
  return ctx.db.runTransaction(async tx => {
    const ref = ctx.db.doc(`planCodes/${codeId}`);
    const code = await tx.get(ref);
    if (!code.exists) fail('not-found', 'ไม่พบโค้ด', 'CODE_INVALID');
    if (code.data()!.status === 'used') fail('failed-precondition', 'ยกเลิกโค้ดที่ใช้แล้วไม่ได้', 'CODE_USED');
    if (code.data()!.status !== 'cancelled') {
      tx.update(ref, { status: 'cancelled', cancelledAt: Timestamp.fromDate(ctx.now()), cancelledBy: actorId });
      writePlanEvent(tx, ctx, code.data()!.teacherUid, { type: 'code-cancelled', actorId, codeId, newPlanId: code.data()!.planId });
    }
    return { codeId, status: 'cancelled' as const };
  });
}
export async function getPlanHistory(ctx: Context, input: { email: string }) {
  const user = await teacher(ctx, input.email);
  const events = await teacherRef(ctx, user.uid).collection('planEvents').orderBy('createdAt', 'desc').get();
  return events.docs.map(doc => {
    const data = doc.data();
    return { eventId: doc.id, type: data.type as string, actorId: data.actorId as string, codeId: data.codeId as string | null, oldPlanId: data.oldPlanId as string | null, newPlanId: data.newPlanId as string | null, oldExpiresAt: data.oldExpiresAt?.toDate().toISOString() ?? null, newExpiresAt: data.newExpiresAt?.toDate().toISOString() ?? null, requestId: data.requestId as string | null, createdAt: data.createdAt.toDate().toISOString() as string };
  });
}
