import { expect, it } from 'vitest';
// Shared contracts proposed for the plan callables in model-plan.md.
import {
  PLAN_DEFINITIONS,
  previewPlanCodeSchema,
  redeemPlanCodeSchema,
  planSummarySchema,
  deleteClassSchema,
} from '@home-work/shared';

it('defines ranks and classroom limits in one shared contract', () => {
  expect(PLAN_DEFINITIONS).toMatchObject({
    starter: { rank: 0, classroomLimit: 2 },
    level1: { rank: 1, classroomLimit: 6 },
    level2: { rank: 2, classroomLimit: 15 },
    level3: { rank: 3, classroomLimit: null },
  });
});

const code = 'A-long-random-activation-code-with-at-least-32-characters';
const redemption = { requestId: 'c0f1ff83-5707-42e2-a79c-5747a274f26f', code, previewToken: 'server-issued-confirmation-token' };

it('accepts a preview without allowing the client to choose its target plan', () => {
  expect(previewPlanCodeSchema.parse({ code })).toEqual({ code });
  expect(previewPlanCodeSchema.safeParse({ code, planId: 'level3' }).success).toBe(false);
});

it.each(['', ' ', null, 123])('rejects invalid code input %j', code => {
  expect(previewPlanCodeSchema.safeParse({ code }).success).toBe(false);
});

it('redemption requires a stable request ID and an explicit preview confirmation', () => {
  expect(redeemPlanCodeSchema.parse(redemption)).toEqual(redemption);
  for (const key of ['requestId', 'code', 'previewToken']) {
    const input = { ...redemption };
    Reflect.deleteProperty(input, key);
    expect(redeemPlanCodeSchema.safeParse(input).success).toBe(false);
  }
});

it.each([
  { teacherUid: 'victim' }, { planId: 'level3' }, { expiresAt: '2099-01-01T00:00:00.000Z' },
  { now: '2026-01-01T00:00:00.000Z' }, { version: 0 },
])('rejects client-controlled plan fields %j', extra => {
  expect(redeemPlanCodeSchema.safeParse({ ...redemption, ...extra }).success).toBe(false);
});

it('summary permits an over-limit Starter and uses null for unlimited', () => {
  expect(planSummarySchema.safeParse({ planId: 'starter', expiresAt: null, schoolYear: 2569, classroomCount: 8, classroomLimit: 2 }).success).toBe(true);
  expect(planSummarySchema.safeParse({ planId: 'level3', expiresAt: '2027-11-10T05:00:00.000Z', schoolYear: 2569, classroomCount: 25, classroomLimit: null }).success).toBe(true);
});

it.each([-1, 1.5])('summary rejects an invalid classroom count %s', classroomCount => {
  expect(planSummarySchema.safeParse({ planId: 'starter', expiresAt: null, schoolYear: 2569, classroomCount, classroomLimit: 2 }).success).toBe(false);
});

it('delete requires the typed classroom name and rejects forged ownership', () => {
  const input = { requestId: redemption.requestId, classId: 'class-a', confirmationName: 'คณิตศาสตร์ · ม.1' };
  expect(deleteClassSchema.parse(input)).toEqual(input);
  expect(deleteClassSchema.safeParse({ ...input, confirmationName: '' }).success).toBe(false);
  expect(deleteClassSchema.safeParse({ ...input, ownerId: 'victim' }).success).toBe(false);
});
