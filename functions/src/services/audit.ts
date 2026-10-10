import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import type { Context } from '../lib/firebase-admin';
import { teacherRef } from '../lib/records';
import { expiresAt } from '../lib/retention';
export function writeAudit(tx: Transaction, ctx: Context, uid: string, requestId: string, action: string, year: number, changes: Record<string, unknown>) {
  tx.create(teacherRef(ctx, uid).collection('auditEntries').doc(requestId), {
    ownerId: uid, action: action === 'changeWorkStatus' && (changes.new as { status?: string } | undefined)?.status === 'not-sent' ? 'clearWork' : action, year, changes, at: Timestamp.fromDate(ctx.now()), expiresAt: Timestamp.fromDate(expiresAt(year)),
  });
}
