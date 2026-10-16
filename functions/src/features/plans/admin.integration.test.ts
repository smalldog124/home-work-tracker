import { getAuth } from 'firebase-admin/auth';
import { beforeEach, expect, it } from 'vitest';
import { testContext } from '../../lib/test-context';
import { hash } from '../../lib/records';
import { createClass } from '../classes/service';
import { randomUUID } from 'node:crypto';
// Trusted admin operations used by the future terminal adapter, never browser callables.
import { findTeacher, createPlanCode, listPlanCodes, cancelPlanCode, getPlanHistory } from './admin';
import { previewPlanCode, redeemPlanCode } from './service';

const { ctx, app, clear, setNow } = testContext();
const uid = 'plan-admin-teacher';
const email = 'plan-admin-teacher@example.test';
const actorId = 'trusted-admin@example.test';
const auth = getAuth(app);
beforeEach(async () => {
  await clear();
  // Auth admin calls must also remain confined to the local demo Emulator.
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '')) throw new Error('Local Auth Emulator required');
  const old = await auth.getUser(uid).catch(error => {
    if (error.code !== 'auth/user-not-found') throw error;
    return null;
  });
  if (old) await auth.deleteUser(uid);
  await auth.createUser({ uid, email, emailVerified: true });
});

it('finds an existing teacher by email with plan and current-year usage', async () => {
  await createClass(ctx, uid, { requestId: randomUUID(), year: 2569, term: 1, subject: 'คณิตศาสตร์', group: 'ม.1' });
  expect(await findTeacher(ctx, { email })).toMatchObject({ uid, email, planId: 'starter', expiresAt: null, schoolYear: 2569, classroomCount: 1 });
});

it('cannot issue a code for an email that has never signed in', async () => {
  await expect(createPlanCode(ctx, actorId, { email: 'unknown@example.test', planId: 'level1' })).rejects.toBeDefined();
  expect((await ctx.db.collection('planCodes').get()).empty).toBe(true);
});

it('issues a random teacher-bound code with a hash ID and exactly thirty days of validity', async () => {
  const issued = await createPlanCode(ctx, actorId, { email, planId: 'level2' });
  expect(issued).toMatchObject({ teacherUid: uid, planId: 'level2', expiresAt: '2026-11-09T05:00:00.000Z', code: expect.any(String) });
  expect(issued.code.length).toBeGreaterThanOrEqual(32);
  expect(issued.codeId).toBe(hash(issued.code));
  const stored = (await ctx.db.doc(`planCodes/${issued.codeId}`).get()).data()!;
  expect(stored).toMatchObject({ teacherUid: uid, planId: 'level2', status: 'unused', createdBy: actorId, usedAt: null, usedBy: null });
  expect(stored.createdAt.toDate().toISOString()).toBe('2026-10-10T05:00:00.000Z');
  expect(stored.expiresAt.toDate().toISOString()).toBe('2026-11-09T05:00:00.000Z');
  expect(JSON.stringify(stored)).not.toContain(issued.code);
  const history = await getPlanHistory(ctx, { email });
  expect(history).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'code-created', actorId, codeId: issued.codeId })]));
  expect(JSON.stringify(history)).not.toContain(issued.code);
});

it('two issued codes differ, and listings never expose either full code', async () => {
  const first = await createPlanCode(ctx, actorId, { email, planId: 'level1' });
  setNow('2026-10-10T05:01:00.000Z');
  const second = await createPlanCode(ctx, actorId, { email, planId: 'level3' });
  expect(second.code).not.toBe(first.code);
  const listed = await listPlanCodes(ctx, { email });
  expect(listed.map((code: { codeId: string }) => code.codeId)).toEqual([second.codeId, first.codeId]);
  expect(JSON.stringify(listed)).not.toContain(first.code);
  expect(JSON.stringify(listed)).not.toContain(second.code);
});

it('list shows an unused code as expired at the exact expiry time', async () => {
  const issued = await createPlanCode(ctx, actorId, { email, planId: 'level1' });
  setNow(issued.expiresAt);
  expect(await listPlanCodes(ctx, { email })).toEqual(expect.arrayContaining([expect.objectContaining({ codeId: issued.codeId, status: 'expired' })]));
  expect((await ctx.db.doc(`planCodes/${issued.codeId}`).get()).data()?.status).toBe('unused');
});

it('cancels an unused code and records the trusted actor without saving the full code', async () => {
  const issued = await createPlanCode(ctx, actorId, { email, planId: 'level1' });
  await cancelPlanCode(ctx, actorId, { codeId: issued.codeId });
  expect((await ctx.db.doc(`planCodes/${issued.codeId}`).get()).data()).toMatchObject({ status: 'cancelled', cancelledBy: actorId });
  await expect(previewPlanCode(ctx, uid, { code: issued.code })).rejects.toBeDefined();
  const history = await getPlanHistory(ctx, { email });
  expect(history).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'code-cancelled', actorId, codeId: issued.codeId })]));
  expect(JSON.stringify(history)).not.toContain(issued.code);
});

it('cannot cancel a used code or revert its successful plan change', async () => {
  const issued = await createPlanCode(ctx, actorId, { email, planId: 'level1' });
  const preview = await previewPlanCode(ctx, uid, { code: issued.code });
  await redeemPlanCode(ctx, uid, { requestId: randomUUID(), code: issued.code, previewToken: preview.previewToken });
  await expect(cancelPlanCode(ctx, actorId, { codeId: issued.codeId })).rejects.toMatchObject({ code: 'failed-precondition' });
  expect((await ctx.db.doc(`planCodes/${issued.codeId}`).get()).data()?.status).toBe('used');
  expect((await ctx.db.doc(`teachers/${uid}/subscription/current`).get()).data()?.planId).toBe('level1');
});

it('cancellation racing with redemption has only one successful outcome', async () => {
  const issued = await createPlanCode(ctx, actorId, { email, planId: 'level1' });
  const preview = await previewPlanCode(ctx, uid, { code: issued.code });
  const outcomes = await Promise.allSettled([
    cancelPlanCode(ctx, actorId, { codeId: issued.codeId }),
    redeemPlanCode(ctx, uid, { requestId: randomUUID(), code: issued.code, previewToken: preview.previewToken }),
  ]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  const stored = (await ctx.db.doc(`planCodes/${issued.codeId}`).get()).data()!;
  const plan = await ctx.db.doc(`teachers/${uid}/subscription/current`).get();
  expect(['used', 'cancelled']).toContain(stored.status);
  expect(plan.exists).toBe(stored.status === 'used');
});

it('list and history are scoped to the selected teacher', async () => {
  await auth.createUser({ uid: 'plan-admin-other', email: 'plan-admin-other@example.test' }).catch(async error => {
    if (error.code !== 'auth/uid-already-exists') throw error;
  });
  const other = await createPlanCode(ctx, actorId, { email: 'plan-admin-other@example.test', planId: 'level3' });
  await createPlanCode(ctx, actorId, { email, planId: 'level1' });
  expect(JSON.stringify(await listPlanCodes(ctx, { email }))).not.toContain(other.codeId);
  expect(JSON.stringify(await getPlanHistory(ctx, { email }))).not.toContain(other.codeId);
});
