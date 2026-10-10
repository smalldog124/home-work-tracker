import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { addStudentSchema, importStudentsSchema, scanSchema, changeWorkSchema, createClassSchema } from '@home-work/shared';
const student = { requestId: randomUUID(), classId: 'class', number: '01', name: ' ชื่อภาษาไทย ทดสอบ ' };
it('normalizes student numbers and trims Thai names', () => expect(addStudentSchema.parse(student)).toMatchObject({ number: 1, name: 'ชื่อภาษาไทย ทดสอบ' }));
it.each(['', '0', '-1', '1.5', 'abc', 0, -2, 1.5, Infinity])('rejects student number %s', number => expect(addStudentSchema.safeParse({ ...student, number }).success).toBe(false));
it.each(['', '   ', '<script>x</script>', 'x'.repeat(201), 'a\u0000b'])('rejects unsafe name %s', name => expect(addStudentSchema.safeParse({ ...student, name }).success).toBe(false));
it('rejects owner, date and internal state injection', () => {
  for (const field of ['ownerId', 'savedAt', 'currentQrId', 'active']) expect(addStudentSchema.safeParse({ ...student, [field]: 'injected' }).success).toBe(false);
});
it('rejects duplicate import numbers including leading zeros', () => expect(importStudentsSchema.safeParse({ requestId: randomUUID(), classId: 'class', expectedRosterVersion: 0, rows: [{ number: '01', name: 'หนึ่ง' }, { number: 1, name: 'ซ้ำ' }] }).success).toBe(false));
it('accepts 200 rows and rejects 201 or formula values', () => {
  const rows = Array.from({ length: 200 }, (_, i) => ({ number: i + 1, name: 'ทดสอบ' }));
  const input = { requestId: randomUUID(), classId: 'class', expectedRosterVersion: 0, rows };
  expect(importStudentsSchema.safeParse(input).success).toBe(true);
  expect(importStudentsSchema.safeParse({ ...input, rows: [...rows, { number: 201, name: 'เกิน' }] }).success).toBe(false);
  expect(importStudentsSchema.safeParse({ ...input, rows: [{ number: { formula: '1+1' }, name: 'สูตร' }] }).success).toBe(false);
});
it('scan rejects not-sent and extra date fields', () => {
  expect(scanSchema.safeParse({ requestId: randomUUID(), payload: 'qr', status: 'not-sent' }).success).toBe(false);
  expect(scanSchema.safeParse({ requestId: randomUUID(), payload: 'qr', status: 'on-time', savedAt: 'old' }).success).toBe(false);
});
it('status edit validates version and fixed references', () => {
  const valid = { requestId: randomUUID(), classId: 'class', studentId: 'student', taskId: 'task', expectedVersion: 0, status: 'not-sent', confirmClear: true };
  expect(changeWorkSchema.safeParse(valid).success).toBe(true);
  expect(changeWorkSchema.safeParse({ ...valid, expectedVersion: -1 }).success).toBe(false);
  expect(changeWorkSchema.safeParse({ ...valid, savedAt: 'old' }).success).toBe(false);
});
it('IDs cannot become paths and class fields are trimmed', () => {
  expect(addStudentSchema.safeParse({ ...student, classId: '../other' }).success).toBe(false);
  expect(createClassSchema.parse({ requestId: randomUUID(), year: 2569, term: 1, subject: ' คณิต ', group: ' ม.1 ' })).toMatchObject({ subject: 'คณิต', group: 'ม.1' });
});
