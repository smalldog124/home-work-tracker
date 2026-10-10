import { randomBytes } from "node:crypto";
import {
  Timestamp,
  type Transaction,
  type DocumentReference,
} from "firebase-admin/firestore";
import type { Context } from "../../lib/firebase-admin";
import {
  hash,
  readClass,
  readRecord,
  type ClassRecord,
  type StudentRecord,
  type TaskRecord,
} from "../../lib/records";
import { expiresAt, assertRetained } from "../../lib/retention";
import { fail } from "../../lib/errors";
export function newQr(
  ownerId: string,
  classId: string,
  studentId: string,
  record: ClassRecord,
  number: number,
) {
  const publicCode = JSON.stringify([
    record.year,
    record.term,
    record.subject,
    record.group,
    number,
  ]);
  const payload = `hw1.${Buffer.from(publicCode).toString("base64url")}.${randomBytes(32).toString("hex")}`;
  return {
    id: hash(payload),
    payload,
    publicCode,
    ownerId,
    classId,
    studentId,
    state: "current",
    year: record.year,
    expiresAt: Timestamp.fromDate(expiresAt(record.year)),
  };
}
export function writeQr(
  tx: Transaction,
  ctx: Context,
  qr: ReturnType<typeof newQr>,
) {
  const { id, ...record } = qr;
  tx.create(ctx.db.collection("qrTokens").doc(id), record);
}
export async function readQr(
  tx: Transaction,
  ctx: Context,
  uid: string,
  payload: string,
) {
  if (!/^hw1\.[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(payload))
    fail(
      "invalid-argument",
      "ไม่พบ QR หรือไม่สามารถใช้ QR นี้ได้",
      "INVALID_QR",
    );
  const qrId = hash(payload);
  const snap = await tx.get(ctx.db.collection("qrTokens").doc(qrId));
  if (!snap.exists)
    fail("not-found", "ไม่พบ QR หรือไม่สามารถใช้ QR นี้ได้", "UNKNOWN_QR");
  const qr = snap.data()!;
  if (qr.ownerId !== uid)
    fail(
      "permission-denied",
      "ไม่สามารถใช้ QR นี้กับบัญชีนี้ได้",
      "QR_WRONG_OWNER",
    );
  assertRetained(qr.year, ctx.now());
  if (qr.state !== "current")
    fail(
      "failed-precondition",
      "QR นี้ใช้ไม่ได้แล้ว กรุณาใช้ QR ใหม่",
      "QR_REPLACED",
    );
  const { ref, record } = await readClass(tx, ctx, uid, qr.classId);
  const student = await readRecord<StudentRecord>(
    tx,
    ref.collection("students").doc(qr.studentId),
  );
  if (student.currentQrId !== qrId)
    fail(
      "failed-precondition",
      "QR นี้ใช้ไม่ได้แล้ว กรุณาใช้ QR ใหม่",
      "QR_REPLACED",
    );
  if (!student.active)
    fail(
      "failed-precondition",
      "ไม่ได้บันทึก เพราะนักเรียนปิดใช้งานอยู่",
      "STUDENT_INACTIVE",
    );
  return {
    ref,
    record,
    student,
    studentId: qr.studentId as string,
    classId: qr.classId as string,
  };
}
export async function resolveQr(ctx: Context, uid: string, payload: string) {
  return ctx.db.runTransaction(async (tx) => {
    const found = await readQr(tx, ctx, uid, payload);
    const [tasks, work] = await Promise.all([
      tx.get(
        found.ref.collection("tasks").orderBy("order", "desc").limit(1001),
      ),
      tx.get(
        found.ref
          .collection("work")
          .where("studentId", "==", found.studentId)
          .limit(1001),
      ),
    ]);
    if (tasks.size > 1000 || work.size > 1000)
      fail(
        "resource-exhausted",
        "รายการมากเกินไป กรุณาติดต่อผู้ดูแล",
        "RESULT_LIMIT",
      );
    return {
      student: {
        id: found.studentId,
        number: found.student.number,
        name: found.student.name,
      },
      class: {
        id: found.classId,
        year: found.record.year,
        term: found.record.term,
        subject: found.record.subject,
        group: found.record.group,
      },
      tasks: tasks.docs.map((doc) => {
        const task = doc.data() as TaskRecord;
        const sent = work.docs.find((w) => w.data().taskId === doc.id)?.data();
        return {
          id: doc.id,
          name: task.name,
          order: task.order,
          status: sent?.status ?? "not-sent",
          savedAt: sent
            ? (sent.savedAt as Timestamp).toDate().toISOString()
            : null,
          selectable: !sent,
        };
      }),
    };
  });
}
async function qrForStudent(
  tx: Transaction,
  ctx: Context,
  ref: DocumentReference,
  studentId: string,
) {
  const student = await readRecord<StudentRecord>(
    tx,
    ref.collection("students").doc(studentId),
  );
  if (!student.active)
    fail("failed-precondition", "นักเรียนปิดใช้งานอยู่", "STUDENT_INACTIVE");
  const qr = await readRecord<{
    payload: string;
    state: string;
    ownerId: string;
    classId: string;
    studentId: string;
  }>(tx, ctx.db.collection("qrTokens").doc(student.currentQrId));
  if (
    qr.state !== "current" ||
    qr.classId !== ref.id ||
    qr.ownerId !== ref.parent.parent!.id ||
    qr.studentId !== studentId
  )
    fail("failed-precondition", "QR นี้ใช้ไม่ได้แล้ว", "QR_REPLACED");
  return {
    studentId,
    number: student.number,
    name: student.name,
    payload: qr.payload,
    publicCode: student.publicCode,
  };
}
export async function getQrData(
  ctx: Context,
  uid: string,
  classId: string,
  studentId?: string,
) {
  return ctx.db.runTransaction(async (tx) => {
    const { ref, record } = await readClass(tx, ctx, uid, classId);
    let ids: string[];
    if (studentId) ids = [studentId];
    else {
      const students = await tx.get(
        ref.collection("students").where("active", "==", true).limit(1001),
      );
      if (students.size > 1000)
        fail(
          "resource-exhausted",
          "ดาวน์โหลดได้ไม่เกิน 1,000 คนต่อครั้ง",
          "RESULT_LIMIT",
        );
      ids = students.docs
        .sort((a, b) => a.data().number - b.data().number)
        .map((doc) => doc.id);
    }
    const cards = await Promise.all(
      ids.map((id) => qrForStudent(tx, ctx, ref, id)),
    );
    return {
      classId,
      year: record.year,
      term: record.term,
      subject: record.subject,
      group: record.group,
      cards,
    };
  });
}
