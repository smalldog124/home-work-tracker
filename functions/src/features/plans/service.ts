import { timingSafeEqual } from 'node:crypto';
import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { PLAN_DEFINITIONS, paidPlanIdSchema, planCodeSchema, planPreviewSchema, planRedemptionSchema, planSummarySchema, type PaidPlanId } from '@home-work/shared';
import type { Context } from '../../lib/firebase-admin';
import { hash, teacherRef } from '../../lib/records';
import { currentSchoolYear } from '../../lib/retention';
import { fail } from '../../lib/errors';
import { effectivePlan, limitFor, planRef, readUsage, writePlanEvent } from './records';

// Calendar arithmetic on Bangkok's wall clock, clamped to the target month's last day.
export function addPlanMonths(date: Date) {
  const thai = new Date(date.getTime() + 7 * 3600000);
  const day = thai.getUTCDate();
  thai.setUTCDate(1);
  thai.setUTCMonth(thai.getUTCMonth() + 13);
  const last = new Date(Date.UTC(thai.getUTCFullYear(), thai.getUTCMonth() + 1, 0)).getUTCDate();
  thai.setUTCDate(Math.min(day, last));
  return new Date(thai.getTime() - 7 * 3600000);
}
export async function getPlanSummary(ctx: Context, uid: string) {
  return ctx.db.runTransaction(async tx => {
    const now = ctx.now();
    const saved = (await tx.get(planRef(ctx, uid))).data();
    const planId = effectivePlan(saved, now);
    const schoolYear = currentSchoolYear(now);
    const { count } = await readUsage(tx, ctx, uid, schoolYear);
    return planSummarySchema.parse({ planId, expiresAt: planId === 'starter' ? null : saved!.expiresAt.toDate().toISOString(), schoolYear, classroomCount: count, classroomLimit: limitFor(planId) });
  });
}
function proposal(uid: string, codeId: string, code: DocumentData | undefined, saved: DocumentData | undefined, now: Date) {
  if (!code) fail('not-found', 'ไม่พบโค้ด หรือโค้ดไม่ถูกต้อง', 'CODE_INVALID');
  if (code.teacherUid !== uid) fail('permission-denied', 'โค้ดนี้ใช้กับบัญชีนี้ไม่ได้', 'CODE_WRONG_ACCOUNT');
  if (code.status === 'used') fail('failed-precondition', 'โค้ดนี้ถูกใช้แล้ว', 'CODE_USED');
  if (code.status === 'cancelled') fail('failed-precondition', 'โค้ดนี้ถูกยกเลิกแล้ว', 'CODE_CANCELLED');
  if (code.status !== 'unused' || !(code.expiresAt instanceof Timestamp)) fail('failed-precondition', 'โค้ดไม่ถูกต้อง', 'CODE_INVALID');
  if (now.getTime() >= code.expiresAt.toMillis()) fail('failed-precondition', 'โค้ดนี้หมดอายุแล้ว', 'CODE_EXPIRED');
  const planId: PaidPlanId = paidPlanIdSchema.parse(code.planId);
  const current = effectivePlan(saved, now);
  if (PLAN_DEFINITIONS[planId].rank < PLAN_DEFINITIONS[current].rank) fail('failed-precondition', 'ยังลดระดับแพ็กเกจไม่ได้ กรุณารอแพ็กเกจปัจจุบันหมดอายุ', 'PLAN_DOWNGRADE');
  const change = current === 'starter' ? 'activation' : current === planId ? 'renewal' : 'upgrade';
  const expiresAt = addPlanMonths(change === 'renewal' ? saved!.expiresAt.toDate() : now).toISOString();
  // Binds confirmation to the account, code, saved-plan version and displayed Thai date.
  // Client-supplied dates are never accepted; redemption always calculates from server time.
  const thaiDay = new Date(new Date(expiresAt).getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const previewToken = hash(JSON.stringify([uid, codeId, saved?.version ?? 0, saved?.expiresAt?.toMillis() ?? null, current, planId, thaiDay]));
  return planPreviewSchema.parse({ planId, expiresAt, previewToken, change });
}
export async function previewPlanCode(ctx: Context, uid: string, input: { code: string }) {
  const codeId = hash(planCodeSchema.parse(input.code));
  return ctx.db.runTransaction(async tx => {
    const [code, saved] = await tx.getAll(ctx.db.doc(`planCodes/${codeId}`), planRef(ctx, uid));
    return proposal(uid, codeId, code.data(), saved.data(), ctx.now());
  });
}
export async function redeemPlanCode(ctx: Context, uid: string, input: { requestId: string; code: string; previewToken: string }) {
  const codeId = hash(planCodeSchema.parse(input.code));
  const request = teacherRef(ctx, uid).collection('planRequests').doc(input.requestId);
  const inputHash = hash(JSON.stringify([codeId, input.previewToken]));
  return ctx.db.runTransaction(async tx => {
    const old = await tx.get(request);
    if (old.exists) {
      if (old.data()!.inputHash !== inputHash) fail('invalid-argument', 'รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว', 'REQUEST_REUSED');
      return planRedemptionSchema.parse(old.data()!.result);
    }
    const ref = ctx.db.doc(`planCodes/${codeId}`);
    const [code, saved] = await tx.getAll(ref, planRef(ctx, uid));
    const now = ctx.now();
    const next = proposal(uid, codeId, code.data(), saved.data(), now);
    const actual = Buffer.from(next.previewToken);
    const expected = Buffer.from(input.previewToken);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      fail('failed-precondition', 'ข้อมูลแพ็กเกจเปลี่ยนแล้ว กรุณาตรวจสอบและยืนยันอีกครั้ง', 'PLAN_PREVIEW_CHANGED', { preview: next });
    const expiresAt = Timestamp.fromDate(new Date(next.expiresAt));
    const result = planRedemptionSchema.parse({ planId: next.planId, expiresAt: next.expiresAt });
    tx.set(planRef(ctx, uid), { planId: next.planId, startedAt: next.change === 'renewal' ? saved.data()!.startedAt : Timestamp.fromDate(now), expiresAt, lastCodeId: codeId, version: (saved.data()?.version ?? 0) + 1, updatedAt: Timestamp.fromDate(now) });
    tx.update(ref, { status: 'used', usedAt: Timestamp.fromDate(now), usedBy: uid, resultPlanExpiresAt: expiresAt });
    writePlanEvent(tx, ctx, uid, { type: next.change === 'activation' ? 'code-redeemed' : next.change, actorId: uid, codeId, oldPlanId: effectivePlan(saved.data(), now), newPlanId: next.planId, oldExpiresAt: saved.data()?.expiresAt ?? null, newExpiresAt: expiresAt, requestId: input.requestId });
    tx.create(request, { action: 'redeemPlanCode', inputHash, result, createdAt: Timestamp.fromDate(now) });
    return result;
  });
}
