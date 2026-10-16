import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import { classroomDisplayName } from '@home-work/shared';
import type { Context } from '../../lib/firebase-admin';
import { classRef, hash, teacherRef, type ClassRecord } from '../../lib/records';
import { fail } from '../../lib/errors';
import { assertRetained } from '../../lib/retention';
import { writeAudit } from '../../services/audit';
import { usageRef } from '../plans/records';

export const deletionJobRef = (ctx: Context, uid: string, classId: string) => ctx.db.doc(`classroomDeletionJobs/${hash(JSON.stringify([uid, classId]))}`);
// All reads precede writes. Also used by expiry without accepting a teacher confirmation.
export async function queueClassDeletion(tx: Transaction, ctx: Context, uid: string, classId: string, actor: string, confirmationName?: string) {
  const ref = classRef(ctx, uid, classId);
  const snap = await tx.get(ref);
  if (!snap.exists || snap.data()!.ownerId !== uid) fail('permission-denied', 'ไม่สามารถเข้าถึงห้องเรียนนี้', 'CLASS_UNAVAILABLE');
  const record = snap.data() as ClassRecord;
  if (confirmationName !== undefined) {
    assertRetained(record.year, ctx.now());
    if (confirmationName !== classroomDisplayName(record.subject, record.group)) fail('failed-precondition', 'กรุณาพิมพ์ชื่อห้องเรียนให้ตรงกับชื่อที่แสดง', 'CONFIRM_CLASS_DELETE');
  }
  if (record.status === 'deleting') return record;
  const usage = usageRef(ctx, uid, record.year);
  const count = await tx.get(usage);
  const now = Timestamp.fromDate(ctx.now());
  if (count.exists) {
    const value = count.data()!.classroomCount;
    if (!Number.isSafeInteger(value) || value <= 0) fail('failed-precondition', 'จำนวนห้องเรียนไม่ถูกต้อง กรุณาติดต่อผู้ดูแล', 'USAGE_INVALID');
    tx.update(usage, { classroomCount: value - 1, updatedAt: now });
  } else if (confirmationName !== undefined) {
    fail('failed-precondition', 'ไม่พบจำนวนห้องเรียน กรุณาติดต่อผู้ดูแล', 'USAGE_MISSING');
  }
  tx.update(ref, { status: 'deleting', deletionRequestedAt: now, deletionRequestedBy: actor });
  tx.set(deletionJobRef(ctx, uid, classId), { teacherUid: uid, classId, schoolYear: record.year, status: 'pending', attempts: 0, createdAt: now, updatedAt: now, nextAttemptAt: now, completedAt: null, lastError: null, leaseToken: null });
  return record;
}
export function deleteClass(ctx: Context, uid: string, input: { requestId: string; classId: string; confirmationName: string }) {
  const receipt = teacherRef(ctx, uid).collection('classDeletionRequests').doc(input.requestId);
  const inputHash = hash(JSON.stringify([input.classId, input.confirmationName]));
  return ctx.db.runTransaction(async tx => {
    const old = await tx.get(receipt);
    if (old.exists) {
      if (old.data()!.inputHash !== inputHash) fail('invalid-argument', 'รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว', 'REQUEST_REUSED');
      return old.data()!.result as { classId: string; status: 'deleting' };
    }
    const record = await queueClassDeletion(tx, ctx, uid, input.classId, uid, input.confirmationName);
    const result = { classId: input.classId, status: 'deleting' as const };
    // Keep a minimal receipt beyond cleanup so an old retry cannot delete a replacement.
    tx.create(receipt, { action: 'deleteClass', inputHash, result, createdAt: Timestamp.fromDate(ctx.now()) });
    if (record.status !== 'deleting') writeAudit(tx, ctx, uid, input.requestId, 'deleteClass', record.year, { classId: input.classId });
    return result;
  });
}
