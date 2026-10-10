import {
  Timestamp,
  type Transaction,
  type DocumentReference,
} from "firebase-admin/firestore";
import {
  pastWorkSchema,
  type ScanInput,
  type ChangeWorkInput,
} from "@home-work/shared";
import type { z } from "zod";
import type { Context } from "../../lib/firebase-admin";
import {
  readClass,
  readRecord,
  hash,
  expiryFields,
  type StudentRecord,
  type TaskRecord,
} from "../../lib/records";
import { checkVersion, fail } from "../../lib/errors";
import { mutate } from "../../services/request-results";
import { readQr } from "../qr/service";
function refs(ref: DocumentReference, studentId: string, taskId: string) {
  const id = hash(JSON.stringify([studentId, taskId]));
  return {
    work: ref.collection("work").doc(id),
    revision: ref.collection("workVersions").doc(id),
  };
}
async function readCurrent(
  tx: Transaction,
  ref: DocumentReference,
  studentId: string,
  taskId: string,
) {
  const pair = refs(ref, studentId, taskId);
  const [work, revision] = await tx.getAll(pair.work, pair.revision);
  return { ...pair, sent: work.data(), version: revision.data()?.version ?? 0 };
}
function serialize(status: string, savedAt: Timestamp | null, version: number) {
  return { status, savedAt: savedAt?.toDate().toISOString() ?? null, version };
}
function scan(
  ctx: Context,
  uid: string,
  input: ScanInput | z.infer<typeof pastWorkSchema>,
  past: boolean,
) {
  return mutate(
    ctx,
    uid,
    past ? "savePastWork" : "saveWork",
    input,
    async (tx) => {
      const { ref, record, studentId, classId } = await readQr(
        tx,
        ctx,
        uid,
        input.payload,
      );
      const taskId = past
        ? (input as z.infer<typeof pastWorkSchema>).taskId
        : record.latestTaskId;
      if (!taskId)
        fail(
          "failed-precondition",
          "ไม่ได้บันทึก เพราะยังไม่มีชิ้นงาน",
          "NO_TASK",
          { classId },
        );
      await readRecord<TaskRecord>(tx, ref.collection("tasks").doc(taskId));
      const current = await readCurrent(tx, ref, studentId, taskId);
      if (current.sent)
        fail(
          "already-exists",
          "ไม่ได้บันทึก เพราะส่งงานชิ้นนี้แล้ว",
          "ALREADY_SENT",
          serialize(current.sent.status, current.sent.savedAt, current.version),
        );
      const savedAt = Timestamp.fromDate(ctx.now());
      const version = current.version + 1;
      tx.create(current.work, {
        ...expiryFields(record.year),
        studentId,
        taskId,
        status: input.status,
        savedAt,
        version,
      });
      tx.set(current.revision, {
        ...expiryFields(record.year),
        studentId,
        taskId,
        version,
      });
      const result = serialize(input.status, savedAt, version);
      return {
        result,
        year: record.year,
        changes: {
          classId,
          studentId,
          taskId,
          old: { status: "not-sent" },
          new: result,
        },
      };
    },
  );
}
export const saveWork = (ctx: Context, uid: string, input: ScanInput) =>
  scan(ctx, uid, input, false);
export const savePastWork = (
  ctx: Context,
  uid: string,
  input: z.infer<typeof pastWorkSchema>,
) => scan(ctx, uid, input, true);
export function changeWorkStatus(
  ctx: Context,
  uid: string,
  input: ChangeWorkInput,
) {
  return mutate(ctx, uid, "changeWorkStatus", input, async (tx) => {
    const { ref, record } = await readClass(tx, ctx, uid, input.classId);
    await readRecord<StudentRecord>(
      tx,
      ref.collection("students").doc(input.studentId),
    );
    await readRecord<TaskRecord>(tx, ref.collection("tasks").doc(input.taskId));
    const current = await readCurrent(tx, ref, input.studentId, input.taskId);
    checkVersion(current.version, input.expectedVersion);
    if (input.status === "not-sent" && !input.confirmClear)
      fail(
        "failed-precondition",
        "กรุณายืนยันการเปลี่ยนเป็นยังไม่ส่ง วันที่ส่งจะถูกล้าง",
        "CONFIRM_CLEAR",
      );
    const version = current.version + 1;
    const savedAt: Timestamp | null =
      input.status === "not-sent"
        ? null
        : (current.sent?.savedAt ?? Timestamp.fromDate(ctx.now()));
    if (savedAt)
      tx.set(current.work, {
        ...expiryFields(record.year),
        studentId: input.studentId,
        taskId: input.taskId,
        status: input.status,
        savedAt,
        version,
      });
    else tx.delete(current.work);
    tx.set(current.revision, {
      ...expiryFields(record.year),
      studentId: input.studentId,
      taskId: input.taskId,
      version,
    });
    const result = serialize(input.status, savedAt, version);
    return {
      result,
      year: record.year,
      changes: {
        classId: input.classId,
        studentId: input.studentId,
        taskId: input.taskId,
        old: current.sent
          ? serialize(
              current.sent.status,
              current.sent.savedAt,
              current.version,
            )
          : serialize("not-sent", null, current.version),
        new: result,
      },
    };
  });
}
export async function getWork(
  ctx: Context,
  uid: string,
  input: { classId: string; studentId: string; taskId: string },
) {
  return ctx.db.runTransaction(async (tx) => {
    const { ref } = await readClass(tx, ctx, uid, input.classId);
    await readRecord<StudentRecord>(
      tx,
      ref.collection("students").doc(input.studentId),
    );
    await readRecord<TaskRecord>(tx, ref.collection("tasks").doc(input.taskId));
    const current = await readCurrent(tx, ref, input.studentId, input.taskId);
    return serialize(
      current.sent?.status ?? "not-sent",
      current.sent?.savedAt ?? null,
      current.version,
    );
  });
}
