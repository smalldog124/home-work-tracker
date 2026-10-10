import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { context, type Context } from '../lib/firebase-admin';
async function removeExpired(ctx: Context, query: Query, recursive = false) {
  let removed = 0;
  while (true) {
    const page = await query.limit(100).get();
    if (page.empty) return removed;
    if (recursive) {
      for (const doc of page.docs) { await ctx.db.recursiveDelete(doc.ref); removed++; }
    } else {
      const batch = ctx.db.batch(); page.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit(); removed += page.size;
    }
  }
}
export async function expireSchoolYears(ctx: Context) {
  const cutoff = Timestamp.fromDate(ctx.now());
  // Each collection is cleaned independently: interrupted class deletion cannot orphan QR, audit or requests forever.
  const classes = await removeExpired(ctx, ctx.db.collectionGroup('classes').where('expiresAt', '<=', cutoff), true);
  let children = 0;
  for (const name of ['students', 'tasks', 'work', 'workVersions']) children += await removeExpired(ctx, ctx.db.collectionGroup(name).where('expiresAt', '<=', cutoff));
  const qr = await removeExpired(ctx, ctx.db.collection('qrTokens').where('expiresAt', '<=', cutoff));
  const requests = await removeExpired(ctx, ctx.db.collectionGroup('requestResults').where('expiresAt', '<=', cutoff));
  const audit = await removeExpired(ctx, ctx.db.collectionGroup('auditEntries').where('expiresAt', '<=', cutoff));
  const limits = await removeExpired(ctx, ctx.db.collectionGroup('rateLimits').where('expiresAt', '<=', cutoff));
  return { classes, children, qr, requests, audit, limits };
}
export const expireSchoolYearsJob = onSchedule({ schedule: 'every day 00:05', timeZone: 'Asia/Bangkok', region: 'asia-southeast1', timeoutSeconds: 540, memory: '512MiB', minInstances: 0, maxInstances: 1 }, async () => {
  const counts = await expireSchoolYears(context); logger.info('expiry', counts);
});
