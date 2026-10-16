import { randomUUID } from 'node:crypto';
import { Timestamp, type DocumentReference, type Query } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { context, type Context } from '../lib/firebase-admin';
import { classRef, teacherRef } from '../lib/records';

// Every deletion batch checks the worker token in the same transaction as the deletes.
// A resumed, expired worker cannot delete a recreated classroom after another worker finishes.
async function deletePage(ctx: Context, job: DocumentReference, token: string, query: Query) {
  return ctx.db.runTransaction(async tx => {
    const lock = await tx.get(job);
    if (lock.data()?.status !== 'running' || lock.data()?.leaseToken !== token) throw new Error('Deletion lease changed');
    const page = await tx.get(query.limit(100));
    for (const doc of page.docs) tx.delete(doc.ref);
    tx.update(job, { updatedAt: Timestamp.fromDate(ctx.now()), nextAttemptAt: Timestamp.fromMillis(ctx.now().getTime() + 10 * 60000) });
    return page.size;
  });
}
export async function processClassroomDeletionJobs(ctx: Context) {
  const now = Timestamp.fromDate(ctx.now());
  let completed = 0;
  for (const state of ['pending', 'running']) {
    const ready = await ctx.db.collection('classroomDeletionJobs').where('status', '==', state).where('nextAttemptAt', '<=', now).limit(25).get();
    for (const candidate of ready.docs) {
      const token = randomUUID();
      const job = await ctx.db.runTransaction(async tx => {
        const current = await tx.get(candidate.ref);
        const data = current.data();
        if (!data || data.status === 'complete' || data.nextAttemptAt.toMillis() > ctx.now().getTime()) return null;
        tx.update(candidate.ref, { status: 'running', attempts: data.attempts + 1, leaseToken: token, updatedAt: Timestamp.fromDate(ctx.now()), nextAttemptAt: Timestamp.fromMillis(ctx.now().getTime() + 10 * 60000) });
        return data;
      });
      if (!job) continue;
      try {
        const ref = classRef(ctx, job.teacherUid, job.classId);
        const queries: Query[] = [
          ...['students', 'tasks', 'work', 'workVersions'].map(name => ref.collection(name)),
          ctx.db.collection('qrTokens').where('ownerId', '==', job.teacherUid).where('classId', '==', job.classId),
          ...['requestResults', 'auditEntries'].map(name => teacherRef(ctx, job.teacherUid).collection(name).where('classId', '==', job.classId)),
        ];
        for (const query of queries) while (await deletePage(ctx, candidate.ref, token, query)) { /* bounded transactional pages */ }
        await ctx.db.runTransaction(async tx => {
          const current = await tx.get(candidate.ref);
          if (current.data()?.status !== 'running' || current.data()?.leaseToken !== token) throw new Error('Deletion lease changed');
          tx.delete(ref);
          tx.update(candidate.ref, { status: 'complete', completedAt: Timestamp.fromDate(ctx.now()), updatedAt: Timestamp.fromDate(ctx.now()), lastError: null, leaseToken: null });
        });
        completed++;
      } catch {
        await ctx.db.runTransaction(async tx => {
          const current = await tx.get(candidate.ref);
          if (current.data()?.status !== 'running' || current.data()?.leaseToken !== token) return;
          tx.update(candidate.ref, { status: 'pending', leaseToken: null, updatedAt: Timestamp.fromDate(ctx.now()), nextAttemptAt: Timestamp.fromMillis(ctx.now().getTime() + Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7))), lastError: 'Cleanup failed; will retry' });
        });
      }
    }
  }
  return { completed };
}
export const classroomDeletionJob = onSchedule({ schedule: 'every 1 minutes', region: 'asia-southeast1', timeoutSeconds: 540, memory: '512MiB', maxInstances: 1 }, async () => { await processClassroomDeletionJobs(context); });
