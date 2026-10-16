import { PLAN_DEFINITIONS, paidPlanIdSchema, type PlanId, type PaidPlanId } from '@home-work/shared';
import { Timestamp, type DocumentData, type Transaction } from 'firebase-admin/firestore';
import type { Context } from '../../lib/firebase-admin';
import { teacherRef } from '../../lib/records';
import { fail } from '../../lib/errors';

export const planRef = (ctx: Context, uid: string) => teacherRef(ctx, uid).collection('subscription').doc('current');
export const usageRef = (ctx: Context, uid: string, year: number) => teacherRef(ctx, uid).collection('classroomUsage').doc(String(year));
export interface PlanRecord { planId: PaidPlanId; startedAt: Timestamp; expiresAt: Timestamp; version: number }
export function effectivePlan(saved: DocumentData | undefined, now: Date): PlanId {
  if (!saved) return 'starter';
  if (!paidPlanIdSchema.safeParse(saved.planId).success || !(saved.expiresAt instanceof Timestamp))
    fail('failed-precondition', 'ข้อมูลแพ็กเกจไม่ถูกต้อง กรุณาติดต่อผู้ดูแล', 'PLAN_INVALID');
  return now.getTime() >= saved.expiresAt.toMillis() ? 'starter' : saved.planId;
}
export async function readUsage(tx: Transaction, ctx: Context, uid: string, year: number) {
  const ref = usageRef(ctx, uid, year);
  const snap = await tx.get(ref);
  if (snap.exists) {
    const count = snap.data()!.classroomCount;
    if (!Number.isSafeInteger(count) || count < 0) fail('failed-precondition', 'จำนวนห้องเรียนไม่ถูกต้อง กรุณาติดต่อผู้ดูแล', 'USAGE_INVALID');
    return { ref, count };
  }
  const existing = await tx.get(teacherRef(ctx, uid).collection('classes').where('year', '==', year).limit(1));
  if (!existing.empty) fail('failed-precondition', 'ไม่พบจำนวนห้องเรียน กรุณาติดต่อผู้ดูแลเพื่อตรวจสอบ', 'USAGE_MISSING');
  return { ref, count: 0 };
}
export const limitFor = (id: PlanId) => PLAN_DEFINITIONS[id].classroomLimit;
export function writePlanEvent(tx: Transaction, ctx: Context, uid: string, fields: Record<string, unknown>) {
  tx.create(teacherRef(ctx, uid).collection('planEvents').doc(), {
    actorId: null, codeId: null, oldPlanId: null, newPlanId: null, oldExpiresAt: null, newExpiresAt: null, requestId: null,
    ...fields, createdAt: Timestamp.fromDate(ctx.now()),
  });
}
