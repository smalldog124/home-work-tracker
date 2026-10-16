import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, expect, it } from 'vitest';
import { testContext } from '../../lib/test-context';
import { hash } from '../../lib/records';
import { generatePlanCode } from './code';
import { expireSchoolYears } from '../../jobs/expire-school-years';
// Proposed public service contract for model-plan.md; production is intentionally absent.
import { getPlanSummary, previewPlanCode, redeemPlanCode } from './service';

const { ctx, clear, setNow } = testContext();
const uid = 'teacher-a';
const planRef = () => ctx.db.doc(`teachers/${uid}/subscription/current`);
const events = () => ctx.db.collection(`teachers/${uid}/planEvents`);
const requests = () => ctx.db.collection(`teachers/${uid}/planRequests`);
const stamp = (iso: string) => Timestamp.fromDate(new Date(iso));
beforeEach(clear);

async function seedPlan(planId = 'level1', expiresAt = '2027-01-31T17:30:00.000Z') {
  await planRef().set({ planId, startedAt: stamp('2026-01-01T05:00:00.000Z'), expiresAt: stamp(expiresAt), lastCodeId: 'previous', version: 1, updatedAt: Timestamp.fromDate(ctx.now()) });
}
async function seedCode(planId = 'level1', overrides: Record<string, unknown> = {}) {
  const code = generatePlanCode();
  const ref = ctx.db.doc(`planCodes/${hash(code)}`);
  await ref.set({ teacherUid: uid, planId, status: 'unused', createdAt: Timestamp.fromDate(ctx.now()), expiresAt: stamp('2026-11-09T05:00:00.000Z'), createdBy: 'admin@example.test', usedAt: null, usedBy: null, cancelledAt: null, cancelledBy: null, resultPlanExpiresAt: null, ...overrides });
  return { code, ref };
}
async function confirm(code: string, requestId = randomUUID()) {
  const preview = await previewPlanCode(ctx, uid, { code });
  return redeemPlanCode(ctx, uid, { code, requestId, previewToken: preview.previewToken });
}

it('a missing plan and empty new year mean Starter with two places', async () => {
  expect(await getPlanSummary(ctx, uid)).toMatchObject({ planId: 'starter', expiresAt: null, schoolYear: 2569, classroomCount: 0, classroomLimit: 2 });
  expect((await planRef().get()).exists).toBe(false);
});

it.each([
  ['level1', 6], ['level2', 15], ['level3', null],
] as const)('summary exposes %s and its shared limit', async (planId, classroomLimit) => {
  await seedPlan(planId);
  await ctx.db.doc(`teachers/${uid}/classroomUsage/2569`).set({ schoolYear: 2569, classroomCount: 4, updatedAt: Timestamp.fromDate(ctx.now()) });
  await ctx.db.doc(`teachers/${uid}/classroomUsage/2568`).set({ schoolYear: 2568, classroomCount: 12, updatedAt: Timestamp.fromDate(ctx.now()) });
  expect(await getPlanSummary(ctx, uid)).toMatchObject({ planId, classroomLimit, classroomCount: 4, schoolYear: 2569, expiresAt: '2027-01-31T17:30:00.000Z' });
});

it('expiry at the exact server time shows Starter and keeps an over-limit count', async () => {
  await seedPlan('level2', ctx.now().toISOString());
  await ctx.db.doc(`teachers/${uid}/classroomUsage/2569`).set({ schoolYear: 2569, classroomCount: 8, updatedAt: Timestamp.fromDate(ctx.now()) });
  expect(await getPlanSummary(ctx, uid)).toMatchObject({ planId: 'starter', classroomCount: 8, classroomLimit: 2 });
  expect((await planRef().get()).data()?.planId).toBe('level2');
});

it('preview reports the new period without reserving the code or changing the plan', async () => {
  const { code, ref } = await seedCode('level2');
  expect(await previewPlanCode(ctx, uid, { code })).toMatchObject({ planId: 'level2', expiresAt: '2027-11-10T05:00:00.000Z', previewToken: expect.any(String) });
  expect((await ref.get()).data()?.status).toBe('unused');
  expect((await planRef().get()).exists).toBe(false);
  expect((await events().get()).empty).toBe(true);
  expect((await requests().get()).empty).toBe(true);
});

it.each(['level1', 'level2', 'level3'])('Starter activates %s for thirteen months from server time', async planId => {
  const { code, ref } = await seedCode(planId);
  expect(await confirm(code)).toMatchObject({ planId, expiresAt: '2027-11-10T05:00:00.000Z' });
  const saved = (await planRef().get()).data()!;
  expect(saved.planId).toBe(planId);
  expect(saved.startedAt.toDate().toISOString()).toBe('2026-10-10T05:00:00.000Z');
  expect(saved.expiresAt.toDate().toISOString()).toBe('2027-11-10T05:00:00.000Z');
  expect((await ref.get()).data()).toMatchObject({ status: 'used', usedBy: uid, resultPlanExpiresAt: saved.expiresAt });
});

it('same-level renewal preserves startedAt and adds thirteen months to the old expiry', async () => {
  await seedPlan();
  const { code } = await seedCode();
  expect(await confirm(code)).toMatchObject({ planId: 'level1', expiresAt: '2028-02-29T17:30:00.000Z' });
  const saved = (await planRef().get()).data()!;
  expect(saved.startedAt.toDate().toISOString()).toBe('2026-01-01T05:00:00.000Z');
  expect(saved.version).toBe(2);
});

it('upgrade starts now and discards remaining time on the lower plan', async () => {
  await seedPlan('level1', '2028-12-01T05:00:00.000Z');
  const { code } = await seedCode('level3');
  expect(await confirm(code)).toMatchObject({ planId: 'level3', expiresAt: '2027-11-10T05:00:00.000Z' });
  expect((await planRef().get()).data()?.startedAt.toDate().toISOString()).toBe(ctx.now().toISOString());
});

it.each([['level2', 'level1'], ['level3', 'level1'], ['level3', 'level2']])('active %s rejects a %s downgrade and keeps the code unused', async (active, target) => {
  await seedPlan(active);
  const before = (await planRef().get()).data();
  const { code, ref } = await seedCode(target);
  await expect(previewPlanCode(ctx, uid, { code })).rejects.toMatchObject({ code: 'failed-precondition' });
  await expect(redeemPlanCode(ctx, uid, { requestId: randomUUID(), code, previewToken: 'forged' })).rejects.toBeDefined();
  expect((await ref.get()).data()?.status).toBe('unused');
  expect((await planRef().get()).data()).toEqual(before);
  expect((await events().get()).empty).toBe(true);
});

it('an expired higher plan can activate a lower level as a new period', async () => {
  await seedPlan('level3', ctx.now().toISOString());
  const { code } = await seedCode('level1');
  expect(await confirm(code)).toMatchObject({ planId: 'level1', expiresAt: '2027-11-10T05:00:00.000Z' });
  expect((await planRef().get()).data()?.startedAt.toDate().toISOString()).toBe(ctx.now().toISOString());
});

it.each([
  ['2026-01-31T16:30:00.000Z', '2027-02-28T16:30:00.000Z'],
  ['2027-01-31T16:30:00.000Z', '2028-02-29T16:30:00.000Z'],
  ['2027-01-31T17:30:00.000Z', '2028-02-29T17:30:00.000Z'],
  ['2028-02-29T05:00:00.000Z', '2029-03-29T05:00:00.000Z'],
  ['2026-12-31T16:59:59.000Z', '2028-01-31T16:59:59.000Z'],
])('calendar addition in Bangkok: %s ends at %s', async (now, expected) => {
  setNow(now);
  const { code } = await seedCode('level1', { expiresAt: Timestamp.fromMillis(ctx.now().getTime() + 30 * 86400000) });
  expect(await confirm(code)).toMatchObject({ expiresAt: expected });
});

it.each([
  ['used', { status: 'used', usedBy: uid, usedAt: stamp('2026-10-09T05:00:00.000Z') }],
  ['cancelled', { status: 'cancelled' }],
  ['expired', { expiresAt: stamp('2026-10-10T05:00:00.000Z') }],
  ['wrong account', { teacherUid: 'teacher-b' }],
] as const)('%s code cannot preview or redeem and reveals no other teacher details', async (_name, overrides) => {
  const { code, ref } = await seedCode('level1', overrides);
  const before = (await ref.get()).data();
  for (const action of [
    () => previewPlanCode(ctx, uid, { code }),
    () => redeemPlanCode(ctx, uid, { requestId: randomUUID(), code, previewToken: 'forged' }),
  ]) {
    await expect(action()).rejects.toBeDefined();
    try { await action(); } catch (error) {
      expect(JSON.stringify(error)).not.toContain('teacher-b');
      expect(JSON.stringify(error)).not.toContain(code);
    }
  }
  expect((await ref.get()).data()).toEqual(before);
  expect((await planRef().get()).exists).toBe(false);
  expect((await events().get()).empty).toBe(true);
});

it('an unknown code is rejected without writing a plan or result', async () => {
  await expect(previewPlanCode(ctx, uid, { code: generatePlanCode() })).rejects.toMatchObject({ code: 'not-found' });
  expect((await requests().get()).empty).toBe(true);
  expect((await planRef().get()).exists).toBe(false);
});

it('confirmation checks code expiry again after a valid preview', async () => {
  const { code, ref } = await seedCode();
  const preview = await previewPlanCode(ctx, uid, { code });
  setNow('2026-11-09T05:00:00.000Z');
  await expect(redeemPlanCode(ctx, uid, { code, requestId: randomUUID(), previewToken: preview.previewToken })).rejects.toBeDefined();
  expect((await ref.get()).data()?.status).toBe('unused');
  expect((await planRef().get()).exists).toBe(false);
});

it('cancellation after preview is checked again at confirmation', async () => {
  const { code, ref } = await seedCode();
  const preview = await previewPlanCode(ctx, uid, { code });
  await ref.update({ status: 'cancelled' });
  await expect(redeemPlanCode(ctx, uid, { code, requestId: randomUUID(), previewToken: preview.previewToken })).rejects.toBeDefined();
  expect((await planRef().get()).exists).toBe(false);
});

it('a changed preview requires a new confirmation and leaves the second code unused', async () => {
  const first = await seedCode();
  const second = await seedCode();
  const preview = await previewPlanCode(ctx, uid, { code: second.code });
  await confirm(first.code);
  await expect(redeemPlanCode(ctx, uid, { code: second.code, requestId: randomUUID(), previewToken: preview.previewToken })).rejects.toMatchObject({ code: 'failed-precondition' });
  expect((await second.ref.get()).data()?.status).toBe('unused');
  expect(await previewPlanCode(ctx, uid, { code: second.code })).toMatchObject({ expiresAt: '2028-12-10T05:00:00.000Z' });
  expect(await confirm(second.code)).toMatchObject({ expiresAt: '2028-12-10T05:00:00.000Z' });
});

it('two different requests using one code have only one successful effect', async () => {
  const { code, ref } = await seedCode();
  const preview = await previewPlanCode(ctx, uid, { code });
  const results = await Promise.allSettled([1, 2].map(() => redeemPlanCode(ctx, uid, { code, requestId: randomUUID(), previewToken: preview.previewToken })));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await ref.get()).data()?.status).toBe('used');
  expect((await planRef().get()).data()?.version).toBe(1);
  expect((await requests().get()).size).toBe(1);
});

it('concurrent retries and a late retry return the saved result without extending twice', async () => {
  const { code } = await seedCode();
  const preview = await previewPlanCode(ctx, uid, { code });
  const input = { code, requestId: randomUUID(), previewToken: preview.previewToken };
  const [first, retry] = await Promise.all([redeemPlanCode(ctx, uid, input), redeemPlanCode(ctx, uid, input)]);
  expect(retry).toEqual(first);
  const savedPlan = (await planRef().get()).data();
  const savedEvents = (await events().get()).docs.map(doc => doc.data());
  expect(savedEvents.length).toBeGreaterThan(0);
  setNow('2026-11-10T05:00:00.000Z');
  expect(await redeemPlanCode(ctx, uid, input)).toEqual(first);
  expect((await planRef().get()).data()).toEqual(savedPlan);
  expect((await events().get()).docs.map(doc => doc.data())).toEqual(savedEvents);
  expect((await requests().get()).size).toBe(1);
  expect(JSON.stringify((await requests().get()).docs.map(doc => doc.data()))).not.toContain(code);
  expect(JSON.stringify(savedEvents)).not.toContain(code);
});

it('reusing a request ID with another code is rejected without consuming it', async () => {
  const first = await seedCode();
  const requestId = randomUUID();
  await confirm(first.code, requestId);
  const second = await seedCode();
  const preview = await previewPlanCode(ctx, uid, { code: second.code });
  await expect(redeemPlanCode(ctx, uid, { requestId, code: second.code, previewToken: preview.previewToken })).rejects.toMatchObject({ details: { reason: 'REQUEST_REUSED' } });
  expect((await second.ref.get()).data()?.status).toBe('unused');
});

it('school-year cleanup keeps plan history and successful redemption results', async () => {
  const { code } = await seedCode();
  const preview = await previewPlanCode(ctx, uid, { code });
  const input = { code, requestId: randomUUID(), previewToken: preview.previewToken };
  const result = await redeemPlanCode(ctx, uid, input);
  const count = (await events().get()).size;
  setNow('2030-05-01T05:00:00.000Z');
  await expireSchoolYears(ctx);
  expect((await events().get()).size).toBe(count);
  expect((await requests().doc(input.requestId).get()).exists).toBe(true);
  expect((await planRef().get()).exists).toBe(true);
  expect(await redeemPlanCode(ctx, uid, input)).toEqual(result);
});
