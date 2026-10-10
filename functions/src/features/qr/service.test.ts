import { expect, it } from 'vitest';
import { resolveQrSchema } from '@home-work/shared';
import { newQr } from './service';
import type { ClassRecord } from '../../lib/records';
const record: ClassRecord = { ownerId: 'teacher', year: 2569, term: 1, subject: 'คณิตศาสตร์', group: 'ม.1/1', rosterVersion: 0, version: 1, latestTaskId: null };
it('public codes distinguish contexts with delimiter characters', () => {
  const first = newQr('teacher', 'one', 'student', { ...record, subject: 'a/b', group: 'c' }, 1);
  const second = newQr('teacher', 'two', 'student', { ...record, subject: 'a', group: 'b/c' }, 1);
  expect(first.publicCode).not.toBe(second.publicCode);
});
it('QR payload includes no student name and token changes on regeneration', () => {
  const first = newQr('teacher', 'class', 'student', record, 1); const second = newQr('teacher', 'class', 'student', record, 1);
  expect(first.payload).not.toBe(second.payload); expect(first.publicCode).toBe(second.publicCode);
  expect(JSON.parse(Buffer.from(first.payload.split('.')[1], 'base64url').toString())).toEqual([2569, 1, 'คณิตศาสตร์', 'ม.1/1', 1]);
  expect(first.payload.split('.')[2]).toMatch(/^[a-f0-9]{64}$/);
});
it('maximum-length Thai class names still produce an accepted QR payload', () => {
  const qr = newQr('teacher', 'class', 'student', { ...record, subject: 'ก'.repeat(200), group: 'ข'.repeat(200) }, 999999);
  expect(resolveQrSchema.safeParse({ payload: qr.payload }).success).toBe(true);
});
