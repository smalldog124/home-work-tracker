import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, expect, it } from 'vitest';
import { testContext } from '../../lib/test-context';
import { createClass, getRetention } from './service';
import { addStudent } from '../students/service';

const { ctx, clear, setNow } = testContext();
const uid = 'teacher-a';
const usage = (year = 2569) => ctx.db.doc(`teachers/${uid}/classroomUsage/${year}`);
const input = (group: string, term: 1 | 2 = 1, year = 2569) => ({
  requestId: randomUUID(), year, term, subject: 'คณิตศาสตร์', group,
});
async function paid(planId: string, expiresAt = '2027-11-10T05:00:00.000Z') {
  await ctx.db.doc(`teachers/${uid}/subscription/current`).set({
    planId, startedAt: Timestamp.fromDate(ctx.now()), expiresAt: Timestamp.fromDate(new Date(expiresAt)),
    lastCodeId: 'seed-code', version: 1, updatedAt: Timestamp.fromDate(ctx.now()),
  });
}
beforeEach(clear);

it.each([
  ['starter', 2], ['level1', 6], ['level2', 15],
] as const)('%s accepts exactly %i current-year classrooms', async (plan, limit) => {
  if (plan !== 'starter') await paid(plan);
  for (let n = 0; n < limit; n++) await createClass(ctx, uid, input(`ม.1/${n}`));
  await expect(createClass(ctx, uid, input('เกินจำนวน'))).rejects.toMatchObject({ code: 'resource-exhausted' });
  expect((await usage().get()).data()?.classroomCount).toBe(limit);
  expect((await ctx.db.collection(`teachers/${uid}/classes`).get()).size).toBe(limit);
});

it('Level 3 permits more than the Level 2 cap and retains the three-year policy', async () => {
  await paid('level3');
  for (let n = 0; n < 17; n++) await createClass(ctx, uid, input(`ม.1/${n}`));
  expect((await usage().get()).data()?.classroomCount).toBe(17);
  expect(getRetention(ctx).retainedYears).toEqual([2567, 2568, 2569]);
});

it('both terms and different subjects share one yearly limit', async () => {
  await createClass(ctx, uid, input('ม.1', 1));
  await createClass(ctx, uid, { ...input('ม.1', 2), subject: 'ภาษาไทย' });
  await expect(createClass(ctx, uid, input('ม.2', 2))).rejects.toMatchObject({ code: 'resource-exhausted' });
  expect((await usage().get()).data()?.classroomCount).toBe(2);
});

it('two concurrent requests for the last place create only one classroom', async () => {
  await createClass(ctx, uid, input('ม.1'));
  const results = await Promise.allSettled(['ม.2', 'ม.3'].map(group => createClass(ctx, uid, input(group))));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(result => result.status === 'rejected')).toMatchObject([{ reason: { code: 'resource-exhausted' } }]);
  expect((await usage().get()).data()?.classroomCount).toBe(2);
  expect((await ctx.db.collection(`teachers/${uid}/classes`).get()).size).toBe(2);
});

it('a retry at the cap returns the original result and never increments usage twice', async () => {
  const firstInput = input('ม.1');
  const first = await createClass(ctx, uid, firstInput);
  await createClass(ctx, uid, input('ม.2'));
  expect(await createClass(ctx, uid, firstInput)).toEqual(first);
  expect((await usage().get()).data()?.classroomCount).toBe(2);
});

it('concurrent identical requests return one result and consume one place', async () => {
  const request = input('ม.1');
  const [a, b] = await Promise.all([createClass(ctx, uid, request), createClass(ctx, uid, request)]);
  expect(a).toEqual(b);
  expect((await usage().get()).data()?.classroomCount).toBe(1);
});

it('an existing classroom does not consume another place', async () => {
  await createClass(ctx, uid, input('ม.1'));
  await expect(createClass(ctx, uid, input('ม.1'))).rejects.toMatchObject({ details: { reason: 'DUPLICATE_CLASS' } });
  expect((await usage().get()).data()?.classroomCount).toBe(1);
  await expect(createClass(ctx, uid, input('ม.2'))).resolves.toMatchObject({ group: 'ม.2' });
});

it.each([2567, 2568, 2570])('rejects creation in year %i even if it is retained', async year => {
  await expect(createClass(ctx, uid, input('ม.1', 1, year))).rejects.toMatchObject({ code: 'failed-precondition' });
  expect((await ctx.db.collection(`teachers/${uid}/classes`).get()).empty).toBe(true);
});

it('May 1 at midnight in Bangkok starts a separate Buddhist-year count', async () => {
  setNow('2026-04-30T16:59:59.999Z');
  await createClass(ctx, uid, input('ม.1', 1, 2568));
  await createClass(ctx, uid, input('ม.2', 2, 2568));
  setNow('2026-04-30T17:00:00.000Z');
  await expect(createClass(ctx, uid, input('ม.3', 1, 2568))).rejects.toMatchObject({ code: 'failed-precondition' });
  await createClass(ctx, uid, input('ม.1'));
  expect((await usage(2568).get()).data()?.classroomCount).toBe(2);
  expect((await usage(2569).get()).data()?.classroomCount).toBe(1);
});

it('an expired paid plan applies Starter immediately while existing classrooms remain usable', async () => {
  await paid('level1', '2026-10-10T05:01:00.000Z');
  const first = await createClass(ctx, uid, input('ม.1'));
  await createClass(ctx, uid, input('ม.2'));
  await createClass(ctx, uid, input('ม.3'));
  setNow('2026-10-10T05:01:00.000Z');
  await expect(createClass(ctx, uid, input('ม.4'))).rejects.toMatchObject({ code: 'resource-exhausted' });
  await expect(addStudent(ctx, uid, { requestId: randomUUID(), classId: first.classId, number: 1, name: 'นักเรียน' })).resolves.toHaveProperty('id');
  expect((await usage().get()).data()?.classroomCount).toBe(3);
});

it('teachers have independent usage documents', async () => {
  await createClass(ctx, uid, input('ม.1'));
  await createClass(ctx, uid, input('ม.2'));
  await createClass(ctx, 'teacher-b', input('ม.1'));
  expect((await usage().get()).data()?.classroomCount).toBe(2);
  expect((await ctx.db.doc('teachers/teacher-b/classroomUsage/2569').get()).data()?.classroomCount).toBe(1);
});

it('a missing usage document cannot let an existing full year bypass the cap', async () => {
  await createClass(ctx, uid, input('ม.1'));
  await createClass(ctx, uid, input('ม.2'));
  await usage().delete();
  await expect(createClass(ctx, uid, input('ม.3'))).rejects.toBeDefined();
  expect((await ctx.db.collection(`teachers/${uid}/classes`).get()).size).toBe(2);
});
