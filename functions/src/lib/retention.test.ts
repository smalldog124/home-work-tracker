import { describe, expect, it } from 'vitest';
import { currentSchoolYear, expiresAt, retentionInfo, assertRetained } from './retention';
describe('Thai school-year retention', () => {
  it.each([
    ['2026-04-30T16:59:59.999Z', 2568],
    ['2026-04-30T17:00:00.000Z', 2569],
    ['2026-12-31T17:00:00.000Z', 2569],
    ['2027-04-30T17:00:00.000Z', 2570],
  ])('%s maps to %i', (date, year) => expect(currentSchoolYear(new Date(date))).toBe(year));
  it('expires at midnight Bangkok May 1, three years later', () => expect(expiresAt(2567).toISOString()).toBe('2027-04-30T17:00:00.000Z'));
  it('notice starts exactly 30 days before expiry', () => {
    expect(retentionInfo(new Date('2027-03-31T16:59:59.999Z')).notice).toBeNull();
    expect(retentionInfo(new Date('2027-03-31T17:00:00.000Z')).notice).toMatchObject({ year: 2567, days: 30 });
  });
  it('permits only current year and previous two', () => {
    for (const year of [2567, 2568, 2569]) expect(() => assertRetained(year, new Date('2026-10-10'))).not.toThrow();
    for (const year of [2566, 2570]) expect(() => assertRetained(year, new Date('2026-10-10'))).toThrow();
  });
});
