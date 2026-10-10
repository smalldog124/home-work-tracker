import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import type { z } from 'zod';
import { addStudentSchema, updateStudentSchema, toggleStudentSchema } from '@home-work/shared';
import type { Context } from '../../lib/firebase-admin';
import { readClass, readRecord, expiryFields, type StudentRecord } from '../../lib/records';
import { checkVersion, fail } from '../../lib/errors';
import { mutate } from '../../services/request-results';
import { newQr, writeQr } from '../qr/service';
function publicStudent(id: string, record: StudentRecord) {
  return { id, number: record.number, name: record.name, active: record.active, version: record.version, publicCode: record.publicCode };
}
export function addStudent(ctx: Context, uid: string, input: z.infer<typeof addStudentSchema>) {
  const studentId = randomUUID();
  return mutate(ctx, uid, 'addStudent', input, async tx => {
    const { ref, record } = await readClass(tx, ctx, uid, input.classId);
    const duplicates = await tx.get(ref.collection('students').where('number', '==', input.number).limit(1));
    if (!duplicates.empty) fail('already-exists', 'เลขที่นี้ถูกใช้แล้ว รวมถึงนักเรียนที่ปิดใช้งาน', 'DUPLICATE_NUMBER');
    const qr = newQr(uid, input.classId, studentId, record, input.number);
    const student: StudentRecord = { ...expiryFields(record.year), number: input.number, name: input.name, active: true, version: 1, currentQrId: qr.id, publicCode: qr.publicCode };
    tx.create(ref.collection('students').doc(studentId), student); writeQr(tx, ctx, qr);
    tx.update(ref, { rosterVersion: record.rosterVersion + 1, version: record.version + 1 });
    return { result: publicStudent(studentId, student), year: record.year, changes: { classId: input.classId, studentId, new: publicStudent(studentId, student) } };
  });
}
export function updateStudent(ctx: Context, uid: string, input: z.infer<typeof updateStudentSchema>) {
  return mutate(ctx, uid, 'updateStudent', input, async tx => {
    const { ref, record } = await readClass(tx, ctx, uid, input.classId);
    const studentRef = ref.collection('students').doc(input.studentId);
    const old = await readRecord<StudentRecord>(tx, studentRef); checkVersion(old.version, input.expectedVersion);
    const renumber = old.number !== input.number;
    if (renumber && !input.confirmNumberChange) fail('failed-precondition', 'กรุณายืนยันการเปลี่ยนเลขที่ QR เดิมจะหยุดทำงาน', 'CONFIRM_NUMBER_CHANGE');
    const duplicates = await tx.get(ref.collection('students').where('number', '==', input.number).limit(1));
    if (duplicates.docs.some(doc => doc.id !== input.studentId)) fail('already-exists', 'เลขที่นี้ถูกใช้แล้ว', 'DUPLICATE_NUMBER');
    const updated = { ...old, number: input.number, name: input.name, version: old.version + 1 };
    if (renumber) {
      const qr = newQr(uid, input.classId, input.studentId, record, input.number);
      updated.currentQrId = qr.id; updated.publicCode = qr.publicCode;
      tx.update(ctx.db.collection('qrTokens').doc(old.currentQrId), { state: 'replaced', replacedAt: Timestamp.fromDate(ctx.now()) });
      writeQr(tx, ctx, qr);
    }
    tx.set(studentRef, updated); tx.update(ref, { rosterVersion: record.rosterVersion + 1, version: record.version + 1 });
    return { result: { ...publicStudent(input.studentId, updated), qrReplaced: renumber }, year: record.year, changes: { classId: input.classId, studentId: input.studentId, old: publicStudent(input.studentId, old), new: publicStudent(input.studentId, updated) } };
  });
}
export function setStudentActive(ctx: Context, uid: string, input: z.infer<typeof toggleStudentSchema>) {
  return mutate(ctx, uid, 'setStudentActive', input, async tx => {
    const { ref, record } = await readClass(tx, ctx, uid, input.classId);
    const studentRef = ref.collection('students').doc(input.studentId);
    const old = await readRecord<StudentRecord>(tx, studentRef); checkVersion(old.version, input.expectedVersion);
    const updated = { ...old, active: input.active, version: old.version + 1 };
    tx.update(studentRef, { active: updated.active, version: updated.version }); tx.update(ref, { rosterVersion: record.rosterVersion + 1, version: record.version + 1 });
    return { result: publicStudent(input.studentId, updated), year: record.year, changes: { classId: input.classId, studentId: input.studentId, old: { active: old.active }, new: { active: updated.active } } };
  });
}
