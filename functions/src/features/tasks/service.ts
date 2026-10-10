import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { z } from "zod";
import {
  createTaskSchema,
  renameTaskSchema,
  deleteTaskSchema,
} from "@home-work/shared";
import type { Context } from "../../lib/firebase-admin";
import {
  readClass,
  readRecord,
  expiryFields,
  type TaskRecord,
} from "../../lib/records";
import { checkVersion, fail } from "../../lib/errors";
import { mutate } from "../../services/request-results";
export function createTask(
  ctx: Context,
  uid: string,
  input: z.infer<typeof createTaskSchema>,
) {
  const taskId = randomUUID();
  return mutate(ctx, uid, "createTask", input, async (tx) => {
    const { ref, record } = await readClass(tx, ctx, uid, input.classId);
    const highest = await tx.get(
      ref.collection("tasks").orderBy("order", "desc").limit(1),
    );
    const order = (highest.docs[0]?.data().order ?? 0) + 1;
    const task = {
      ...expiryFields(record.year),
      name: input.name ?? `ชิ้นงานที่ ${order}`,
      order,
      version: 1,
      createdAt: Timestamp.fromDate(ctx.now()),
    };
    tx.create(ref.collection("tasks").doc(taskId), task);
    tx.update(ref, { latestTaskId: taskId, version: record.version + 1 });
    return {
      result: { taskId, name: task.name, order, version: 1 },
      year: record.year,
      changes: {
        classId: input.classId,
        taskId,
        new: { name: task.name, order },
      },
    };
  });
}
export function renameTask(
  ctx: Context,
  uid: string,
  input: z.infer<typeof renameTaskSchema>,
) {
  return mutate(ctx, uid, "renameTask", input, async (tx) => {
    const { ref, record } = await readClass(tx, ctx, uid, input.classId);
    const taskRef = ref.collection("tasks").doc(input.taskId);
    const old = await readRecord<TaskRecord>(tx, taskRef);
    checkVersion(old.version, input.expectedVersion);
    tx.update(taskRef, { name: input.name, version: old.version + 1 });
    return {
      result: {
        taskId: input.taskId,
        name: input.name,
        version: old.version + 1,
      },
      year: record.year,
      changes: {
        classId: input.classId,
        taskId: input.taskId,
        old: { name: old.name },
        new: { name: input.name },
      },
    };
  });
}
export function deleteTask(
  ctx: Context,
  uid: string,
  input: z.infer<typeof deleteTaskSchema>,
) {
  return mutate(ctx, uid, "deleteTask", input, async (tx) => {
    const { ref, record } = await readClass(tx, ctx, uid, input.classId);
    const taskRef = ref.collection("tasks").doc(input.taskId);
    const task = await readRecord<TaskRecord>(tx, taskRef);
    checkVersion(task.version, input.expectedVersion);
    const work = await tx.get(
      ref.collection("work").where("taskId", "==", input.taskId).limit(1),
    );
    if (!work.empty)
      fail(
        "failed-precondition",
        "ลบไม่ได้ เพราะยังมีรายการส่งงาน",
        "TASK_HAS_WORK",
      );
    const remaining = await tx.get(
      ref.collection("tasks").orderBy("order", "desc").limit(2),
    );
    const latest =
      remaining.docs.find((doc) => doc.id !== input.taskId)?.id ?? null;
    tx.delete(taskRef);
    tx.update(ref, { latestTaskId: latest, version: record.version + 1 });
    return {
      result: { taskId: input.taskId, deleted: true },
      year: record.year,
      changes: {
        classId: input.classId,
        taskId: input.taskId,
        old: { name: task.name, order: task.order },
      },
    };
  });
}
