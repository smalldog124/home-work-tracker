import { createHash } from 'node:crypto';
import { Timestamp, type DocumentReference, type Transaction, type DocumentData } from 'firebase-admin/firestore';
import type { Context } from './firebase-admin';
import { assertRetained, expiresAt } from './retention';
import { fail } from './errors';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const teacherRef = (ctx: Context, uid: string) => ctx.db.collection('teachers').doc(uid);
export const classRef = (ctx: Context, uid: string, classId: string) => teacherRef(ctx, uid).collection('classes').doc(classId);
export interface ClassRecord extends DocumentData {
  ownerId: string; year: number; term: number; subject: string; group: string;
  rosterVersion: number; version: number; latestTaskId: string | null;
}
export interface StudentRecord extends DocumentData {
  number: number; name: string; active: boolean; version: number; currentQrId: string; publicCode: string;
}
export interface TaskRecord extends DocumentData { name: string; order: number; version: number }
export async function readClass(tx: Transaction, ctx: Context, uid: string, id: string) {
  const ref = classRef(ctx, uid, id);
  const snap = await tx.get(ref);
  if (!snap.exists || snap.data()!.ownerId !== uid) fail('permission-denied', 'ไม่สามารถเข้าถึงห้องเรียนนี้', 'CLASS_UNAVAILABLE');
  const record = snap.data() as ClassRecord;
  if (record.status === 'deleting') fail('failed-precondition', 'ห้องเรียนนี้กำลังลบข้อมูล ไม่สามารถใช้งานได้', 'CLASS_DELETING');
  assertRetained(record.year, ctx.now());
  return { ref, record };
}
export async function readRecord<T>(tx: Transaction, ref: DocumentReference): Promise<T> {
  const snap = await tx.get(ref);
  if (!snap.exists) fail('not-found', 'ไม่พบข้อมูลที่ต้องการ', 'RECORD_NOT_FOUND');
  return snap.data() as T;
}

export const expiryFields = (year: number) => ({ year, expiresAt: Timestamp.fromDate(expiresAt(year)) });
