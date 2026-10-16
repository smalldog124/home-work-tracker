import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { importStudentsSchema, addStudentSchema, updateStudentSchema, scanSchema, changeWorkSchema } from '@home-work/shared';
import { testContext } from '../../lib/test-context';
import { teacherRef, classRef } from '../../lib/records';
import { createClass } from '../classes/service';
import { saveSubject } from '../subjects/service';
import { addStudent, updateStudent, setStudentActive } from '../students/service';
import { importStudents } from '../students/import';
import { createTask, renameTask, deleteTask } from '../tasks/service';
import { getQrData, resolveQr } from '../qr/service';
import { saveWork, savePastWork, changeWorkStatus, getWork } from './service';
import { getRequestResult } from '../../services/request-results';
import { expireSchoolYears } from '../../jobs/expire-school-years';
import { rateLimit, rateFor } from '../../lib/rate-limit';
const { ctx, clear, setNow } = testContext();
const uid = 'teacher-a'; const rid = () => randomUUID();
let classId: string, studentId: string, payload: string;
let tasks: Awaited<ReturnType<typeof createTask>>[];
beforeEach(async () => {
  await clear();
  classId = (await createClass(ctx, uid, { requestId: rid(), year: 2569, term: 1, subject: 'คณิตศาสตร์', group: 'ม.1/1' })).classId;
  studentId = (await addStudent(ctx, uid, { requestId: rid(), classId, number: 1, name: 'สมชาย ทดสอบ' })).id;
  payload = (await getQrData(ctx, uid, classId, studentId)).cards[0].payload;
  tasks = [];
  for (let i = 0; i < 3; i++) tasks.push(await createTask(ctx, uid, { requestId: rid(), classId }));
});
const scanInput = () => scanSchema.parse({ requestId: rid(), payload, status: 'on-time' });
const workInput = (taskId = tasks[2].taskId, status = 'late-1', expectedVersion = 0) => changeWorkSchema.parse({ requestId: rid(), classId, studentId, taskId, status, expectedVersion, confirmClear: status === 'not-sent' });
const studentInput = (number: number, version = 1) => updateStudentSchema.parse({ requestId: rid(), classId, studentId, number, name: 'ชื่อใหม่ ทดสอบ', expectedVersion: version, confirmNumberChange: true });

it('normal scan targets latest task and creates request, work and audit together', async () => {
  const input = scanInput(); const result = await saveWork(ctx, uid, input);
  expect(result).toEqual({ status: 'on-time', savedAt: '2026-10-10T05:00:00.000Z', version: 1 });
  expect(await getWork(ctx, uid, { classId, studentId, taskId: tasks[0].taskId })).toMatchObject({ status: 'not-sent', savedAt: null });
  expect(await getWork(ctx, uid, { classId, studentId, taskId: tasks[2].taskId })).toEqual(result);
  expect(await getRequestResult(ctx, uid, input.requestId)).toEqual({ state: 'confirmed', action: 'saveWork', result });
  const audit = await teacherRef(ctx, uid).collection('auditEntries').doc(input.requestId).get();
  expect(audit.data()?.changes).toMatchObject({ studentId, taskId: tasks[2].taskId });
  expect(JSON.stringify(audit.data())).not.toContain(payload);
});
it.each(['on-time', 'late-1', 'late-2', 'late-3', 'late-4'] as const)('stores %s exactly as chosen', async status => {
  expect(await saveWork(ctx, uid, { ...scanInput(), status })).toMatchObject({ status });
});
it('duplicate scan never overwrites original date or status', async () => {
  await saveWork(ctx, uid, scanInput()); setNow('2026-10-11T05:00:00.000Z');
  await expect(saveWork(ctx, uid, { ...scanInput(), status: 'late-4' })).rejects.toMatchObject({ code: 'already-exists', details: { reason: 'ALREADY_SENT', status: 'on-time', savedAt: '2026-10-10T05:00:00.000Z' } });
  expect((await getWork(ctx, uid, { classId, studentId, taskId: tasks[2].taskId })).status).toBe('on-time');
});
it('two simultaneous scans cannot create two work records', async () => {
  const outcomes = await Promise.allSettled([saveWork(ctx, uid, scanInput()), saveWork(ctx, uid, scanInput())]);
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
  expect((await classRef(ctx, uid, classId).collection('work').get()).size).toBe(1);
});
it('retry returns first result after newer task creation and cannot restore cleared work', async () => {
  const input = scanInput(); const first = await saveWork(ctx, uid, input);
  await createTask(ctx, uid, { requestId: rid(), classId });
  expect(await saveWork(ctx, uid, input)).toEqual(first);
  await changeWorkStatus(ctx, uid, workInput(tasks[2].taskId, 'not-sent', 1));
  expect(await saveWork(ctx, uid, input)).toEqual(first);
  expect((await getWork(ctx, uid, { classId, studentId, taskId: tasks[2].taskId })).status).toBe('not-sent');
  expect((await classRef(ctx, uid, classId).collection('work').get()).size).toBe(0);
});
it('same request ID with different action or data is rejected', async () => {
  const input = scanInput(); await saveWork(ctx, uid, input);
  await expect(saveWork(ctx, uid, { ...input, status: 'late-1' })).rejects.toMatchObject({ details: { reason: 'REQUEST_REUSED' } });
  await expect(savePastWork(ctx, uid, { ...input, taskId: tasks[0].taskId, confirmed: true })).rejects.toMatchObject({ details: { reason: 'REQUEST_REUSED' } });
});
it('QR lookup does not save; past work saves chosen task and checks again', async () => {
  await saveWork(ctx, uid, scanInput());
  const found = await resolveQr(ctx, uid, payload);
  expect(found.tasks.map(t => t.id)).toEqual(tasks.map(t => t.taskId).reverse()); expect(found.tasks[0].selectable).toBe(false);
  expect((await classRef(ctx, uid, classId).collection('work').get()).size).toBe(1);
  const input = { ...scanInput(), taskId: tasks[0].taskId, confirmed: true as const };
  await changeWorkStatus(ctx, uid, workInput(tasks[0].taskId));
  await expect(savePastWork(ctx, uid, input)).rejects.toMatchObject({ details: { reason: 'ALREADY_SENT' } });
  expect((await classRef(ctx, uid, classId).collection('work').get()).size).toBe(2);
});
it('past-work save uses confirmation date rather than task creation date', async () => {
  setNow('2026-10-12T17:01:00.000Z');
  expect(await savePastWork(ctx, uid, { ...scanInput(), taskId: tasks[0].taskId, confirmed: true })).toMatchObject({ savedAt: '2026-10-12T17:01:00.000Z' });
});
it('sent-to-sent preserves date, clear removes record, re-send sets a new date', async () => {
  const first = await saveWork(ctx, uid, scanInput()); setNow('2026-10-11T17:00:00.000Z');
  expect(await changeWorkStatus(ctx, uid, workInput(tasks[2].taskId, 'late-4', 1))).toMatchObject({ savedAt: first.savedAt, version: 2 });
  await expect(changeWorkStatus(ctx, uid, { ...workInput(tasks[2].taskId, 'not-sent', 2), confirmClear: false })).rejects.toMatchObject({ details: { reason: 'CONFIRM_CLEAR' } });
  expect(await changeWorkStatus(ctx, uid, workInput(tasks[2].taskId, 'not-sent', 2))).toEqual({ status: 'not-sent', savedAt: null, version: 3 });
  expect((await classRef(ctx, uid, classId).collection('work').get()).size).toBe(0);
  expect(await changeWorkStatus(ctx, uid, workInput(tasks[2].taskId, 'on-time', 3))).toMatchObject({ savedAt: '2026-10-11T17:00:00.000Z', version: 4 });
});
it('work revision survives clear and rejects stale not-sent forms (ABA)', async () => {
  await saveWork(ctx, uid, scanInput()); await changeWorkStatus(ctx, uid, workInput(tasks[2].taskId, 'not-sent', 1));
  await expect(changeWorkStatus(ctx, uid, workInput(tasks[2].taskId, 'late-1', 0))).rejects.toMatchObject({ details: { reason: 'VERSION_CONFLICT' } });
});
it('renumber keeps internal ID and work; old QR stays invalid after disable and restore', async () => {
  await saveWork(ctx, uid, scanInput()); await updateStudent(ctx, uid, studentInput(10));
  await expect(resolveQr(ctx, uid, payload)).rejects.toMatchObject({ details: { reason: 'QR_REPLACED' } });
  const current = (await getQrData(ctx, uid, classId, studentId)).cards[0].payload;
  expect(current).not.toBe(payload); expect((await resolveQr(ctx, uid, current)).student.id).toBe(studentId);
  expect((await getWork(ctx, uid, { classId, studentId, taskId: tasks[2].taskId })).status).toBe('on-time');
  await setStudentActive(ctx, uid, { requestId: rid(), classId, studentId, expectedVersion: 2, active: false, confirmed: true });
  await expect(resolveQr(ctx, uid, current)).rejects.toMatchObject({ details: { reason: 'STUDENT_INACTIVE' } });
  expect((await getQrData(ctx, uid, classId)).cards).toHaveLength(0);
  await setStudentActive(ctx, uid, { requestId: rid(), classId, studentId, expectedVersion: 3, active: true, confirmed: true });
  expect((await resolveQr(ctx, uid, current)).student.id).toBe(studentId);
  await expect(resolveQr(ctx, uid, payload)).rejects.toMatchObject({ details: { reason: 'QR_REPLACED' } });
});
it('name change keeps QR and stale student edits are rejected', async () => {
  await updateStudent(ctx, uid, studentInput(1));
  expect((await getQrData(ctx, uid, classId, studentId)).cards[0].payload).toBe(payload);
  await expect(updateStudent(ctx, uid, studentInput(2))).rejects.toMatchObject({ details: { reason: 'VERSION_CONFLICT' } });
});
it('renumber requires confirmation and rejects reserved inactive numbers', async () => {
  await expect(updateStudent(ctx, uid, { ...studentInput(2), confirmNumberChange: false })).rejects.toMatchObject({ details: { reason: 'CONFIRM_NUMBER_CHANGE' } });
  const other = await addStudent(ctx, uid, { requestId: rid(), classId, number: 2, name: 'ปิดใช้ ทดสอบ' });
  await setStudentActive(ctx, uid, { requestId: rid(), classId, studentId: other.id, expectedVersion: 1, active: false, confirmed: true });
  await expect(updateStudent(ctx, uid, studentInput(2))).rejects.toMatchObject({ details: { reason: 'DUPLICATE_NUMBER' } });
});
it('simultaneous duplicate student numbers create one student', async () => {
  const outcomes = await Promise.allSettled([1, 2].map(() => addStudent(ctx, uid, { requestId: rid(), classId, number: 2, name: 'ใหม่ ทดสอบ' })));
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
  expect((await classRef(ctx, uid, classId).collection('students').where('number', '==', 2).get()).size).toBe(1);
});
it('simultaneous duplicate classes create one class and teachers remain separate', async () => {
  const input = { year: 2569, term: 1 as const, subject: 'วิทย์', group: 'ม.2' };
  const outcomes = await Promise.allSettled([1, 2].map(() => createClass(ctx, uid, { ...input, requestId: rid() })));
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
  await expect(createClass(ctx, 'teacher-b', { ...input, requestId: rid() })).resolves.toMatchObject({ subject: 'วิทย์' });
});
it('import adds and changes only reviewed numbers; retains work, absentees and active state', async () => {
  await saveWork(ctx, uid, scanInput());
  const off = await addStudent(ctx, uid, { requestId: rid(), classId, number: 2, name: 'ปิดใช้' });
  await setStudentActive(ctx, uid, { requestId: rid(), classId, studentId: off.id, expectedVersion: 1, active: false, confirmed: true });
  const absent = await addStudent(ctx, uid, { requestId: rid(), classId, number: 3, name: 'ไม่มีในไฟล์' });
  const roster = (await classRef(ctx, uid, classId).get()).data()!.rosterVersion;
  const input = importStudentsSchema.parse({ requestId: rid(), classId, expectedRosterVersion: roster, rows: [{ number: 1, name: 'เปลี่ยนชื่อ' }, { number: 2, name: 'ปิดใช้' }, { number: 4, name: 'ใหม่' }] });
  expect(await importStudents(ctx, uid, input)).toMatchObject({ added: 1, changed: 1, unchanged: 1 });
  expect((await classRef(ctx, uid, classId).collection('students').doc(off.id).get()).data()!.active).toBe(false);
  expect((await classRef(ctx, uid, classId).collection('students').doc(absent.id).get()).exists).toBe(true);
  expect((await classRef(ctx, uid, classId).collection('work').get()).size).toBe(1);
  expect((await getQrData(ctx, uid, classId, studentId)).cards[0].payload).toBe(payload);
  const result = await importStudents(ctx, uid, input); expect(result).toMatchObject({ added: 1 });
  expect((await classRef(ctx, uid, classId).collection('students').get()).size).toBe(4);
});
it('200-row import is atomic and replay does not repeat changes', async () => {
  const input = importStudentsSchema.parse({ requestId: rid(), classId, expectedRosterVersion: 1, rows: Array.from({ length: 200 }, (_, i) => ({ number: i + 10, name: `ทดสอบ ${i}` })) });
  expect(await importStudents(ctx, uid, input)).toMatchObject({ added: 200 });
  expect(await importStudents(ctx, uid, input)).toMatchObject({ added: 200 });
  expect((await classRef(ctx, uid, classId).collection('students').get()).size).toBe(201);
  expect((await getQrData(ctx, uid, classId)).cards.map(c => c.number)).toEqual([1, ...Array.from({ length: 200 }, (_, i) => i + 10)]);
});
it('stale import cannot partially update or add students', async () => {
  const input = importStudentsSchema.parse({ requestId: rid(), classId, expectedRosterVersion: 1, rows: [{ number: 1, name: 'เก่า' }, { number: 99, name: 'ใหม่' }] });
  await updateStudent(ctx, uid, studentInput(1));
  await expect(importStudents(ctx, uid, input)).rejects.toMatchObject({ details: { reason: 'VERSION_CONFLICT' } });
  expect((await classRef(ctx, uid, classId).collection('students').get()).size).toBe(1);
  expect((await getQrData(ctx, uid, classId)).cards[0].name).toBe('ชื่อใหม่ ทดสอบ');
  expect(await getRequestResult(ctx, uid, input.requestId)).toEqual({ state: 'unknown' });
});
it('task numbering handles concurrency, renaming and stale versions', async () => {
  const created = await Promise.all([1, 2].map(() => createTask(ctx, uid, { requestId: rid(), classId })));
  expect(created.map(t => t.order).sort()).toEqual([4, 5]);
  expect(created.map(t => t.name).sort()).toEqual(['ชิ้นงานที่ 4', 'ชิ้นงานที่ 5']);
  await renameTask(ctx, uid, { requestId: rid(), classId, taskId: tasks[0].taskId, expectedVersion: 1, name: 'ชื่อใหม่' });
  await expect(renameTask(ctx, uid, { requestId: rid(), classId, taskId: tasks[0].taskId, expectedVersion: 1, name: 'เก่า' })).rejects.toMatchObject({ details: { reason: 'VERSION_CONFLICT' } });
});
it('task delete blocked until work cleared; latest task reference and next name recover', async () => {
  await saveWork(ctx, uid, scanInput()); const input = { requestId: rid(), classId, taskId: tasks[2].taskId, expectedVersion: 1, confirmed: true as const };
  await expect(deleteTask(ctx, uid, input)).rejects.toMatchObject({ details: { reason: 'TASK_HAS_WORK' } });
  await changeWorkStatus(ctx, uid, workInput(tasks[2].taskId, 'not-sent', 1)); await deleteTask(ctx, uid, input);
  expect((await classRef(ctx, uid, classId).get()).data()!.latestTaskId).toBe(tasks[1].taskId);
  await saveWork(ctx, uid, scanInput()); expect((await getWork(ctx, uid, { classId, studentId, taskId: tasks[1].taskId })).status).toBe('on-time');
  expect(await createTask(ctx, uid, { requestId: rid(), classId })).toMatchObject({ order: 3, name: 'ชิ้นงานที่ 3' });
  expect((await teacherRef(ctx, uid).collection('auditEntries').doc(input.requestId).get()).exists).toBe(true);
});
it('no-task scan cannot create a task or work record', async () => {
  for (const t of [...tasks].reverse()) await deleteTask(ctx, uid, { requestId: rid(), classId, taskId: t.taskId, expectedVersion: 1, confirmed: true });
  await expect(saveWork(ctx, uid, scanInput())).rejects.toMatchObject({ details: { reason: 'NO_TASK', classId } });
  expect((await classRef(ctx, uid, classId).collection('tasks').get()).size).toBe(0); expect((await classRef(ctx, uid, classId).collection('work').get()).size).toBe(0);
});
it('another owner cannot read, mutate, import, resolve QR or look up request results', async () => {
  const input = scanInput(); await saveWork(ctx, uid, input);
  await expect(getQrData(ctx, 'teacher-b', classId)).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(resolveQr(ctx, 'teacher-b', payload)).rejects.toMatchObject({ details: { reason: 'QR_WRONG_OWNER' } });
  await expect(saveWork(ctx, 'teacher-b', scanInput())).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(updateStudent(ctx, 'teacher-b', studentInput(2))).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(importStudents(ctx, 'teacher-b', importStudentsSchema.parse({ requestId: rid(), classId, expectedRosterVersion: 1, rows: [{ number: 1, name: 'โจมตี' }] }))).rejects.toMatchObject({ code: 'permission-denied' });
  expect(await getRequestResult(ctx, 'teacher-b', input.requestId)).toEqual({ state: 'unknown' });
});
it('task and student IDs from another class are rejected', async () => {
  const other = await createClass(ctx, uid, { requestId: rid(), year: 2569, term: 1, subject: 'วิทย์', group: 'ม.2' });
  const task = await createTask(ctx, uid, { requestId: rid(), classId: other.classId });
  const student = await addStudent(ctx, uid, addStudentSchema.parse({ requestId: rid(), classId: other.classId, number: 1, name: 'คนอื่น' }));
  await expect(savePastWork(ctx, uid, { ...scanInput(), taskId: task.taskId, confirmed: true })).rejects.toMatchObject({ code: 'not-found' });
  await expect(changeWorkStatus(ctx, uid, { ...workInput(), studentId: student.id })).rejects.toMatchObject({ code: 'not-found' });
});
it('expiry rejects reads/writes/replays before cleanup and removes children, QR, requests and audit', async () => {
  // Create while this is the current year; retained past years are no longer creation inputs.
  setNow('2023-05-01T05:00:00.000Z');
  const old = await createClass(ctx, uid, { requestId: rid(), year: 2566, term: 1, subject: 'เก่า', group: 'เก่า' });
  const student = await addStudent(ctx, uid, { requestId: rid(), classId: old.classId, number: 1, name: 'เก่า' });
  const task = await createTask(ctx, uid, { requestId: rid(), classId: old.classId });
  const qr = (await getQrData(ctx, uid, old.classId)).cards[0].payload;
  const input = { ...scanInput(), payload: qr }; await saveWork(ctx, uid, input);
  setNow('2026-04-30T16:59:59.000Z');
  await expect(resolveQr(ctx, uid, qr)).resolves.toHaveProperty('student');
  setNow('2026-04-30T17:00:00.000Z');
  await expect(resolveQr(ctx, uid, qr)).rejects.toMatchObject({ details: { reason: 'YEAR_UNAVAILABLE' } });
  await expect(saveWork(ctx, uid, input)).rejects.toMatchObject({ details: { reason: 'YEAR_UNAVAILABLE' } });
  await expect(getRequestResult(ctx, uid, input.requestId)).rejects.toMatchObject({ details: { reason: 'YEAR_UNAVAILABLE' } });
  await expect(createClass(ctx, uid, { requestId: rid(), year: 2566, term: 2, subject: 'เก่า', group: 'เก่า' })).rejects.toMatchObject({ details: { reason: 'YEAR_UNAVAILABLE' } });
  const result = await expireSchoolYears(ctx); expect(result.classes).toBe(1); expect(result.qr).toBe(1);
  const oldRef = classRef(ctx, uid, old.classId);
  expect((await oldRef.get()).exists).toBe(false);
  for (const collection of ['students', 'tasks', 'work', 'workVersions']) expect((await oldRef.collection(collection).get()).size).toBe(0);
  expect((await teacherRef(ctx, uid).collection('subjects').where('name', '==', 'เก่า').get()).size).toBe(1);
  expect((await teacherRef(ctx, uid).collection('requestResults').where('year', '==', 2566).get()).size).toBe(0);
  expect((await teacherRef(ctx, uid).collection('auditEntries').where('year', '==', 2566).get()).size).toBe(0);
  expect((await expireSchoolYears(ctx)).classes).toBe(0);
  expect(student.id).toBeTruthy(); expect(task.taskId).toBeTruthy();
});
it('cleanup resumes orphaned records even if parent class was already removed', async () => {
  await classRef(ctx, uid, classId).delete(); setNow('2029-05-01T00:00:00.000Z');
  const result = await expireSchoolYears(ctx); expect(result.qr).toBe(1); expect(result.requests).toBeGreaterThan(0); expect(result.audit).toBeGreaterThan(0);
  // Firestore recursiveDelete alone can lose a deleted parent from the class query;
  // the job must also discover remaining child collections.
  expect((await classRef(ctx, uid, classId).collection('students').get()).size).toBe(0);
});
it('distributed rate limit is stricter for import and reports retry delay', async () => {
  expect(rateFor('importStudents')).toBeLessThan(rateFor('saveWork'));
  for (let i = 0; i < 6; i++) await rateLimit(ctx, uid, 'importStudents');
  await expect(rateLimit(ctx, uid, 'importStudents')).rejects.toMatchObject({ code: 'resource-exhausted', details: { retryAfterSeconds: 60 } });
  setNow('2026-10-10T05:01:00.000Z'); await expect(rateLimit(ctx, uid, 'importStudents')).resolves.toBeUndefined();
});
it('saved subjects are reusable and isolated per teacher', async () => {
  const input = { requestId: rid(), name: 'ภาษาไทย' }; const first = await saveSubject(ctx, uid, input);
  expect(await saveSubject(ctx, uid, input)).toEqual(first);
  expect((await teacherRef(ctx, 'teacher-b').collection('subjects').get()).size).toBe(0);
});
