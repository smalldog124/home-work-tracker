import { Timestamp } from 'firebase-admin/firestore';
import type { Context } from './firebase-admin';
import { teacherRef } from './records';
import { fail } from './errors';
export const rateFor = (action: string) => action === 'importStudents' ? 6 : ['saveWork', 'savePastWork', 'getRequestResult', 'resolveQr'].includes(action) ? 120 : 30;
export async function rateLimit(ctx: Context, uid: string, action: string) {
  const ref = teacherRef(ctx, uid).collection('rateLimits').doc(action);
  await ctx.db.runTransaction(async tx => {
    const snap = await tx.get(ref); const old = snap.data(); const now = ctx.now().getTime();
    const sameWindow = old && now < old.resetAt.toMillis();
    const count = sameWindow ? old.count : 0;
    const resetAt = sameWindow ? old.resetAt as Timestamp : Timestamp.fromMillis(now + 60_000);
    if (count >= rateFor(action)) fail('resource-exhausted', 'คำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่', 'RATE_LIMIT', { retryAfterSeconds: Math.ceil((resetAt.toMillis() - now) / 1000) });
    tx.set(ref, { count: count + 1, resetAt, expiresAt: Timestamp.fromMillis(resetAt.toMillis() + 86_400_000) });
  });
}
