import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import type { Context } from '../lib/firebase-admin';
import { hash, teacherRef, readClass } from '../lib/records';
import { assertRetained, expiresAt } from '../lib/retention';
import { fail } from '../lib/errors';
import { writeAudit } from './audit';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function mutate<T>(ctx: Context, uid: string, action: string, input: { requestId: string }, apply: (tx: Transaction) => Promise<{ result: T; year: number; changes: Record<string, unknown> }>): Promise<T> {
  const ref = teacherRef(ctx, uid).collection('requestResults').doc(input.requestId);
  const fingerprint = hash(canonical({ action, input }));
  return ctx.db.runTransaction(async tx => {
    const old = await tx.get(ref);
    if (old.exists) {
      const data = old.data()!;
      assertRetained(data.year, ctx.now());
      if (data.fingerprint !== fingerprint) fail('invalid-argument', 'รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว', 'REQUEST_REUSED');
      if (data.classId && action !== 'deleteClass') await readClass(tx, ctx, uid, data.classId);
      return data.result as T;
    }
    const { result, year, changes } = await apply(tx);
    assertRetained(year, ctx.now());
    tx.create(ref, { ownerId: uid, action, fingerprint, result, year, classId: changes.classId ?? null, confirmed: true, at: Timestamp.fromDate(ctx.now()), expiresAt: Timestamp.fromDate(expiresAt(year)) });
    writeAudit(tx, ctx, uid, input.requestId, action, year, changes);
    return result;
  });
}
export async function getRequestResult(ctx: Context, uid: string, requestId: string) {
  const deletion = await teacherRef(ctx, uid).collection('classDeletionRequests').doc(requestId).get();
  if (deletion.exists) return { state: 'confirmed' as const, action: 'deleteClass', result: deletion.data()!.result as unknown };
  const snap = await teacherRef(ctx, uid).collection('requestResults').doc(requestId).get();
  if (!snap.exists) return { state: 'unknown' as const };
  const record = snap.data()!; assertRetained(record.year, ctx.now());
  if (record.classId && record.action !== 'deleteClass') await ctx.db.runTransaction(tx => readClass(tx, ctx, uid, record.classId));
  return { state: 'confirmed' as const, action: record.action as string, result: record.result as unknown };
}
