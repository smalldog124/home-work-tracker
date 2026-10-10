import { z } from 'zod';
export const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const requestId = z.string().uuid();
export const text = z.string().trim().min(1).max(200).refine(value => !/[<>\u0000-\u001f]/u.test(value), 'ต้องเป็นข้อความธรรมดา');
export const studentNumber = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).pipe(z.number().int().positive().max(999999));
export const version = z.number().int().nonnegative();
export const studentRow = z.object({ number: studentNumber, name: text }).strict();
export const addStudentSchema = z.object({ requestId, classId: id, ...studentRow.shape }).strict();
export const updateStudentSchema = z.object({ requestId, classId: id, studentId: id, expectedVersion: version, number: studentNumber, name: text, confirmNumberChange: z.boolean().default(false) }).strict();
export const toggleStudentSchema = z.object({ requestId, classId: id, studentId: id, expectedVersion: version, active: z.boolean(), confirmed: z.literal(true) }).strict();
export const importStudentsSchema = z.object({ requestId, classId: id, expectedRosterVersion: version, rows: z.array(studentRow).min(1).max(200) }).strict().superRefine(({ rows }, ctx) => {
  const seen = new Set<number>();
  rows.forEach((row, i) => { if (seen.has(row.number)) ctx.addIssue({ code: 'custom', path: ['rows', i, 'number'], message: 'เลขที่ซ้ำ' }); seen.add(row.number); });
});
