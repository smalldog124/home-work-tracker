import { fail } from './errors';
const DAY = 86_400_000;
export function currentSchoolYear(now: Date): number {
  const thai = new Date(now.getTime() + 7 * 3_600_000);
  return thai.getUTCFullYear() + 543 - (thai.getUTCMonth() < 4 ? 1 : 0);
}
export function expiresAt(year: number): Date {
  return new Date(Date.UTC(year - 543 + 3, 3, 30, 17));
}
export function assertRetained(year: number, now: Date) {
  const current = currentSchoolYear(now);
  if (year < current - 2 || year > current) fail('failed-precondition', 'ปีการศึกษานี้หมดอายุหรือยังไม่เปิดใช้งาน', 'YEAR_UNAVAILABLE');
}
export function retentionInfo(now: Date) {
  const current = currentSchoolYear(now);
  const expiry = expiresAt(current - 2);
  const days = Math.ceil((expiry.getTime() - now.getTime()) / DAY);
  return { currentYear: current, retainedYears: [current - 2, current - 1, current], notice: days <= 30 ? { year: current - 2, expiresAt: expiry.toISOString(), days } : null };
}
