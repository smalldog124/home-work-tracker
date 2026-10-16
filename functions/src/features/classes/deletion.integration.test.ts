import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, expect, it, vi } from 'vitest';
import { testContext } from '../../lib/test-context';
import { createClass } from './service';
import { addStudent, updateStudent, setStudentActive } from '../students/service';
import { importStudents } from '../students/import';
import { createTask, renameTask, deleteTask } from '../tasks/service';
import { getQrData, resolveQr } from '../qr/service';
import { changeWorkStatus, getWork, savePastWork, saveWork } from '../work/service';
import { expireSchoolYears } from '../../jobs/expire-school-years';
// Proposed deletion service and worker boundaries; no production stubs in this round.
import { deleteClass } from './deletion';
import { processClassroomDeletionJobs } from '../../jobs/classroom-deletion';

const { ctx, clear, setNow } = testContext();
const uid = 'teacher-a';
const rid = () => randomUUID();
const createInput = () => ({ requestId: rid(), year: 2569, term: 1 as const, subject: 'คณิตศาสตร์', group: 'ม.1' });
const classes = () => ctx.db.collection(`teachers/${uid}/classes`);
const usage = (year = 2569) => ctx.db.doc(`teachers/${uid}/classroomUsage/${year}`);
const jobs = () => ctx.db.collection('classroomDeletionJobs');
beforeEach(clear);

async function classroom() {
  const klass = await createClass(ctx, uid, createInput());
  const student = await addStudent(ctx, uid, { requestId: rid(), classId: klass.classId, number: 1, name: 'นักเรียน' });
  const task = await createTask(ctx, uid, { requestId: rid(), classId: klass.classId });
  const qr = (await getQrData(ctx, uid, klass.classId)).cards[0].payload;
  await saveWork(ctx, uid, { requestId: rid(), payload: qr, status: 'on-time' });
  return { klass, student, task, qr };
}
// The server returns this displayed name in the deletion UI and requires it verbatim.
const deletion = (classId: string) => ({ requestId: rid(), classId, confirmationName: 'คณิตศาสตร์ · ม.1' });

it('delete immediately frees one place, hides the class and queues exactly one cleanup job', async () => {
  const { klass, qr } = await classroom();
  await createClass(ctx, uid, { ...createInput(), group: 'ม.2' });
  const input = deletion(klass.classId);
  const first = await deleteClass(ctx, uid, input);
  expect(await deleteClass(ctx, uid, input)).toEqual(first);
  expect((await classes().doc(klass.classId).get()).data()).toMatchObject({ status: 'deleting', deletionRequestedBy: uid });
  expect((await usage().get()).data()?.classroomCount).toBe(1);
  expect((await jobs().get()).size).toBe(1);
  await expect(resolveQr(ctx, uid, qr)).rejects.toMatchObject({ code: 'failed-precondition' });
  await expect(createClass(ctx, uid, { ...createInput(), group: 'ม.3' })).resolves.toHaveProperty('classId');
});

it('concurrent delete requests decrement once and never make usage negative', async () => {
  const { klass } = await classroom();
  await Promise.allSettled([1, 2, 3].map(() => deleteClass(ctx, uid, deletion(klass.classId))));
  expect((await classes().doc(klass.classId).get()).data()?.status).toBe('deleting');
  expect((await usage().get()).data()?.classroomCount).toBe(0);
  expect((await jobs().get()).size).toBe(1);
});

it.each(['', 'ม.1', 'ชื่อผิด'])('incorrect typed confirmation %j leaves the class and count unchanged', async confirmationName => {
  const { klass } = await classroom();
  await expect(deleteClass(ctx, uid, { ...deletion(klass.classId), confirmationName })).rejects.toMatchObject({ code: 'failed-precondition' });
  expect((await classes().doc(klass.classId).get()).data()?.status).not.toBe('deleting');
  expect((await usage().get()).data()?.classroomCount).toBe(1);
  expect((await jobs().get()).empty).toBe(true);
});

it('another teacher cannot delete the classroom or free the owner\'s place', async () => {
  const { klass } = await classroom();
  await expect(deleteClass(ctx, 'teacher-b', deletion(klass.classId))).rejects.toMatchObject({ code: 'permission-denied' });
  expect((await usage().get()).data()?.classroomCount).toBe(1);
  expect((await jobs().get()).empty).toBe(true);
});

it('all service access paths reject a deleting classroom, including QR and work retry', async () => {
  const { klass, student, task, qr } = await classroom();
  const classId = klass.classId;
  const savedInput = { requestId: rid(), payload: qr, status: 'late-1' as const };
  // Save an independent request result before deletion so replay cannot bypass access checks.
  await createTask(ctx, uid, { requestId: rid(), classId });
  await saveWork(ctx, uid, savedInput);
  await deleteClass(ctx, uid, deletion(classId));
  const actions = [
    () => getQrData(ctx, uid, classId),
    () => resolveQr(ctx, uid, qr),
    () => getWork(ctx, uid, { classId, studentId: student.id, taskId: task.taskId }),
    () => saveWork(ctx, uid, { ...savedInput, requestId: rid() }),
    () => saveWork(ctx, uid, savedInput),
    () => savePastWork(ctx, uid, { requestId: rid(), payload: qr, status: 'on-time', taskId: task.taskId, confirmed: true }),
    () => changeWorkStatus(ctx, uid, { requestId: rid(), classId, studentId: student.id, taskId: task.taskId, status: 'late-1', expectedVersion: 1, confirmClear: false }),
    () => addStudent(ctx, uid, { requestId: rid(), classId, number: 2, name: 'ใหม่' }),
    () => updateStudent(ctx, uid, { requestId: rid(), classId, studentId: student.id, number: 1, name: 'แก้ไข', expectedVersion: 1, confirmNumberChange: false }),
    () => setStudentActive(ctx, uid, { requestId: rid(), classId, studentId: student.id, expectedVersion: 1, active: false, confirmed: true }),
    () => importStudents(ctx, uid, { requestId: rid(), classId, expectedRosterVersion: 1, rows: [{ number: 2, name: 'ใหม่' }] }),
    () => createTask(ctx, uid, { requestId: rid(), classId }),
    () => renameTask(ctx, uid, { requestId: rid(), classId, taskId: task.taskId, expectedVersion: 1, name: 'แก้ไข' }),
    () => deleteTask(ctx, uid, { requestId: rid(), classId, taskId: task.taskId, expectedVersion: 1, confirmed: true }),
  ];
  for (const action of actions) await expect(action()).rejects.toMatchObject({ code: 'failed-precondition' });
});

it('the same classroom identity stays blocked until cleanup finishes', async () => {
  const { klass } = await classroom();
  await deleteClass(ctx, uid, deletion(klass.classId));
  await expect(createClass(ctx, uid, createInput())).rejects.toBeDefined();
  await processClassroomDeletionJobs(ctx);
  const replacement = await createClass(ctx, uid, createInput());
  expect(replacement.classId).toBe(klass.classId);
  const student = await addStudent(ctx, uid, { requestId: rid(), classId: replacement.classId, number: 7, name: 'ห้องใหม่' });
  await processClassroomDeletionJobs(ctx);
  expect((await classes().doc(replacement.classId).collection('students').doc(student.id).get()).exists).toBe(true);
  expect((await usage().get()).data()?.classroomCount).toBe(1);
});

it('cleanup removes every linked record while retaining another classroom and shared subjects', async () => {
  const { klass } = await classroom();
  const other = await createClass(ctx, uid, { ...createInput(), group: 'ม.2' });
  const otherStudent = await addStudent(ctx, uid, { requestId: rid(), classId: other.classId, number: 1, name: 'ต้องเก็บไว้' });
  const otherQr = (await getQrData(ctx, uid, other.classId)).cards[0].payload;
  await deleteClass(ctx, uid, deletion(klass.classId));
  await processClassroomDeletionJobs(ctx);
  await processClassroomDeletionJobs(ctx);
  expect((await classes().doc(klass.classId).get()).exists).toBe(false);
  for (const name of ['students', 'tasks', 'work', 'workVersions']) expect((await classes().doc(klass.classId).collection(name).get()).empty).toBe(true);
  expect((await ctx.db.collection('qrTokens').where('classId', '==', klass.classId).get()).empty).toBe(true);
  for (const name of ['requestResults', 'auditEntries']) {
    const records = await ctx.db.collection(`teachers/${uid}/${name}`).get();
    expect(records.docs.filter(doc => JSON.stringify(doc.data()).includes(klass.classId))).toHaveLength(0);
  }
  expect((await jobs().get()).docs.map(doc => doc.data().status)).toEqual(['complete']);
  expect((await usage().get()).data()?.classroomCount).toBe(1);
  expect((await resolveQr(ctx, uid, otherQr)).student.id).toBe(otherStudent.id);
  expect((await ctx.db.collection(`teachers/${uid}/subjects`).get()).size).toBe(1);
});

it('a failed external delete is retried without returning the place twice', async () => {
  const { klass } = await classroom();
  await deleteClass(ctx, uid, deletion(klass.classId));
  // Fault injection at the Firestore boundary; the worker and job storage remain real.
  const fault = vi.spyOn(ctx.db, 'recursiveDelete').mockRejectedValueOnce(new Error('temporary Firestore failure'));
  try { await processClassroomDeletionJobs(ctx); } finally { fault.mockRestore(); }
  const job = (await jobs().get()).docs[0].data();
  expect(job).toMatchObject({ status: 'pending', attempts: 1 });
  expect(job.nextAttemptAt.toMillis()).toBeGreaterThan(ctx.now().getTime());
  expect((await usage().get()).data()?.classroomCount).toBe(0);
  setNow(job.nextAttemptAt.toDate().toISOString());
  await processClassroomDeletionJobs(ctx);
  expect((await jobs().get()).docs[0].data().status).toBe('complete');
  expect((await classes().doc(klass.classId).get()).exists).toBe(false);
  expect((await usage().get()).data()?.classroomCount).toBe(0);
});

it('old-year deletion leaves the current year count untouched', async () => {
  setNow('2026-04-30T16:59:59.000Z');
  const old = await createClass(ctx, uid, { ...createInput(), year: 2568 });
  setNow('2026-10-10T05:00:00.000Z');
  await createClass(ctx, uid, createInput());
  await deleteClass(ctx, uid, deletion(old.classId));
  expect((await usage(2568).get()).data()?.classroomCount).toBe(0);
  expect((await usage(2569).get()).data()?.classroomCount).toBe(1);
  await processClassroomDeletionJobs(ctx);
  expect((await usage(2569).get()).data()?.classroomCount).toBe(1);
});

it('Starter with eight classrooms must delete down to one before creating again', async () => {
  await ctx.db.doc(`teachers/${uid}/subscription/current`).set({
    planId: 'level2', startedAt: Timestamp.fromDate(ctx.now()),
    expiresAt: Timestamp.fromDate(new Date('2026-10-10T05:01:00.000Z')),
    lastCodeId: 'seed', version: 1, updatedAt: Timestamp.fromDate(ctx.now()),
  });
  const created = [];
  for (let n = 0; n < 8; n++) created.push(await createClass(ctx, uid, { ...createInput(), group: `ม.1/${n}` }));
  setNow('2026-10-10T05:01:00.000Z');
  for (let n = 0; n < 6; n++) await deleteClass(ctx, uid, {
    ...deletion(created[n].classId), confirmationName: `คณิตศาสตร์ · ม.1/${n}`,
  });
  expect((await usage().get()).data()?.classroomCount).toBe(2);
  await expect(createClass(ctx, uid, { ...createInput(), group: 'ใหม่' })).rejects.toMatchObject({ code: 'resource-exhausted' });
  await deleteClass(ctx, uid, { ...deletion(created[6].classId), confirmationName: 'คณิตศาสตร์ · ม.1/6' });
  await expect(createClass(ctx, uid, { ...createInput(), group: 'ใหม่' })).resolves.toHaveProperty('classId');
  expect((await usage().get()).data()?.classroomCount).toBe(2);
});

it('school-year expiry and queued cleanup cannot decrement usage twice', async () => {
  const { klass } = await classroom();
  await deleteClass(ctx, uid, deletion(klass.classId));
  setNow('2029-05-01T05:00:00.000Z');
  await createClass(ctx, uid, { ...createInput(), year: 2572 });
  await Promise.all([expireSchoolYears(ctx), processClassroomDeletionJobs(ctx)]);
  await processClassroomDeletionJobs(ctx);
  expect((await usage(2569).get()).data()?.classroomCount).toBe(0);
  expect((await usage(2572).get()).data()?.classroomCount).toBe(1);
});
