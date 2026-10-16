import { createServer, type ServerResponse } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { STATUS_LABELS, type WORK_STATUSES } from "@home-work/shared";
import type { Seed, Snapshot } from "./data";

const projectId = "demo-home-work";
if (
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
  !process.env.E2E_CLOCK_FILE
)
  throw new Error("Harness requires loopback demo Emulators");
initializeApp({ projectId });
const db = getFirestore();
const auth = getAuth();
let fault: { mode: string; action: string } | null = null;
const held = new Set<() => void>();
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const statusValue = (label: string) =>
  (Object.keys(STATUS_LABELS) as (typeof WORK_STATUSES)[number][]).find(
    (s) => STATUS_LABELS[s] === label,
  )!;
function expiry(year: number) {
  return {
    year,
    expiresAt: Timestamp.fromDate(
      new Date(Date.UTC(year - 543 + 3, 3, 30, 17)),
    ),
  };
}
async function clock(now: string) {
  await writeFile(process.env.E2E_CLOCK_FILE!, now);
  const thai = new Date(new Date(now).getTime() + 7 * 3600000);
  const year = thai.getUTCFullYear() + 543 - (thai.getUTCMonth() < 4 ? 1 : 0);
  // Keep Rules and service time aligned in this dedicated test project only.
  const original = await readFile(process.env.E2E_RULES_FILE!, "utf8");
  const rules = original.replace(
    /function currentYear\(\) \{[\s\S]*?\n    \}/,
    `function currentYear() { return ${year}; }`,
  );
  const environment = await initializeTestEnvironment({
    projectId,
    firestore: { host: "127.0.0.1", port: 8080, rules },
  });
  await environment.cleanup();
}
async function seed(data: Seed) {
  fault = null;
  for (const release of held) release();
  held.clear();
  await fetch(
    `http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  await fetch(
    `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`,
    { method: "DELETE" },
  );
  await clock(data.now);
  await auth.importUsers(
    data.teachers.map((t) => ({
      uid: t.id,
      email: t.email,
      displayName: t.name,
      emailVerified: true,
      providerData: [
        {
          providerId: "google.com",
          uid: t.id,
          email: t.email,
          displayName: t.name,
        },
      ],
    })),
  );
  // Split batches to stay below Firestore's write limit for large-table fixtures.
  const writes: (() => Promise<unknown>)[] = [];
  // Mirror the plan's server-owned fixtures; browser tests never write these records.
  const usage = new Map<string, { teacherUid: string; year: number; count: number }>();
  for (const klass of data.classes) {
    const key = `${klass.ownerId}/${klass.year}`;
    const row = usage.get(key) ?? { teacherUid: klass.ownerId, year: klass.year, count: 0 };
    row.count++;
    usage.set(key, row);
  }
  for (const row of usage.values()) writes.push(() =>
    db.doc(`teachers/${row.teacherUid}/classroomUsage/${row.year}`).set({
      schoolYear: row.year, classroomCount: row.count, updatedAt: Timestamp.fromDate(new Date(data.now)),
    }),
  );
  for (const plan of data.plans ?? []) writes.push(() =>
    db.doc(`teachers/${plan.teacherUid}/subscription/current`).set({
      planId: plan.planId, startedAt: Timestamp.fromDate(new Date(plan.startedAt)),
      expiresAt: Timestamp.fromDate(new Date(plan.expiresAt)), lastCodeId: 'seed-code',
      version: 1, updatedAt: Timestamp.fromDate(new Date(data.now)),
    }),
  );
  for (const code of data.planCodes ?? []) writes.push(() =>
    db.doc(`planCodes/${hash(code.code)}`).set({
      teacherUid: code.teacherUid, planId: code.planId, status: code.status,
      createdAt: Timestamp.fromDate(new Date(code.createdAt)), expiresAt: Timestamp.fromDate(new Date(code.expiresAt)),
      createdBy: 'e2e-admin', usedAt: code.status === 'used' ? Timestamp.fromDate(new Date(data.now)) : null,
      usedBy: code.status === 'used' ? code.teacherUid : null,
      cancelledAt: code.status === 'cancelled' ? Timestamp.fromDate(new Date(data.now)) : null,
      cancelledBy: code.status === 'cancelled' ? 'e2e-admin' : null, resultPlanExpiresAt: null,
    }),
  );
  for (const t of data.teachers)
    writes.push(() =>
      db
        .doc(`teachers/${t.id}`)
        .set({ ownerId: t.id, name: t.name, email: t.email }),
    );
  const classMap = new Map(data.classes.map((c) => [c.id, c]));
  for (const c of data.classes) {
    const tasks = data.tasks
      .filter((t) => t.classId === c.id)
      .sort((a, b) => b.order - a.order);
    writes.push(() =>
      db
        .doc(`teachers/${c.ownerId}/subjects/${hash(c.subject)}`)
        .set({ ownerId: c.ownerId, name: c.subject }),
    );
    writes.push(() =>
      db.doc(`teachers/${c.ownerId}/classes/${c.id}`).set({
        ...c,
        status: "active",
        ...expiry(c.year),
        subjectId: hash(c.subject),
        version: 1,
        rosterVersion: 1,
        latestTaskId: tasks[0]?.id || null,
        createdAt: Timestamp.fromDate(new Date(data.now)),
      }),
    );
  }
  const qr: Record<string, string> = {};
  for (const s of data.students) {
    const c = classMap.get(s.classId)!;
    const publicCode = JSON.stringify([
      c.year,
      c.term,
      c.subject,
      c.group,
      s.number,
    ]);
    const payload = `hw1.${Buffer.from(publicCode).toString("base64url")}.${hash(JSON.stringify([c.ownerId, c.id, s.id, publicCode]))}`;
    qr[s.id] = payload;
    writes.push(() =>
      db.doc(`teachers/${c.ownerId}/classes/${c.id}/students/${s.id}`).set({
        ...s,
        ...expiry(c.year),
        version: 1,
        currentQrId: hash(payload),
        publicCode,
      }),
    );
    writes.push(() =>
      db.doc(`qrTokens/${hash(payload)}`).set({
        payload,
        publicCode,
        ownerId: c.ownerId,
        classId: c.id,
        studentId: s.id,
        state: "current",
        ...expiry(c.year),
      }),
    );
  }
  for (const t of data.tasks) {
    const c = classMap.get(t.classId)!;
    writes.push(() =>
      db.doc(`teachers/${c.ownerId}/classes/${c.id}/tasks/${t.id}`).set({
        ...t,
        ...expiry(c.year),
        version: 1,
        createdAt: Timestamp.fromDate(new Date(t.createdAt)),
      }),
    );
  }
  for (const w of data.work) {
    const s = data.students.find((s) => s.id === w.studentId)!;
    const c = classMap.get(s.classId)!;
    const pair = hash(JSON.stringify([w.studentId, w.taskId]));
    const ref = `teachers/${c.ownerId}/classes/${c.id}`;
    writes.push(() =>
      db.doc(`${ref}/work/${pair}`).set({
        studentId: w.studentId,
        taskId: w.taskId,
        ...expiry(c.year),
        status: statusValue(w.status),
        savedAt: Timestamp.fromDate(new Date(w.savedAt)),
        version: 1,
      }),
    );
    writes.push(() =>
      db.doc(`${ref}/workVersions/${pair}`).set({
        studentId: w.studentId,
        taskId: w.taskId,
        ...expiry(c.year),
        version: 1,
      }),
    );
  }
  for (let offset = 0; offset < writes.length; offset += 30)
    await Promise.all(writes.slice(offset, offset + 30).map((run) => run()));
  const replacedQr = `hw1.b2xk.${"f".repeat(64)}`;
  if (data.classes[0] && data.students[0])
    await db.doc(`qrTokens/${hash(replacedQr)}`).set({
      ownerId: data.classes[0].ownerId,
      classId: data.classes[0].id,
      studentId: data.students[0].id,
      state: "replaced",
      payload: replacedQr,
      ...expiry(data.classes[0].year),
    });
  return { qr, replacedQr };
}
async function snapshot(): Promise<Snapshot> {
  const result: Snapshot = {
    students: [],
    tasks: [],
    work: [],
    requests: [],
    audit: [],
  };
  const teachers = await db.collection("teachers").get();
  for (const teacher of teachers.docs) {
    const classes = await teacher.ref.collection("classes").get();
    for (const c of classes.docs) {
      const [students, tasks, work] = await Promise.all(
        ["students", "tasks", "work"].map((p) => c.ref.collection(p).get()),
      );
      result.students.push(
        ...students.docs.map((s) => ({
          id: s.id,
          classId: c.id,
          number: s.get("number"),
          name: s.get("name"),
          active: s.get("active"),
        })),
      );
      result.tasks.push(
        ...tasks.docs.map((t) => ({
          id: t.id,
          classId: c.id,
          order: t.get("order"),
          name: t.get("name"),
          createdAt: t.get("createdAt").toDate().toISOString(),
        })),
      );
      result.work.push(
        ...work.docs.map((w) => ({
          classId: c.id,
          studentId: w.get("studentId"),
          taskId: w.get("taskId"),
          status: STATUS_LABELS[w.get("status") as keyof typeof STATUS_LABELS],
          savedAt: w.get("savedAt").toDate().toISOString(),
        })),
      );
    }
    const [requests, audit] = await Promise.all(
      ["requestResults", "auditEntries"].map((p) =>
        teacher.ref.collection(p).get(),
      ),
    );
    result.requests.push(
      ...requests.docs.map((r) => ({
        id: r.id,
        ownerId: teacher.id,
        action: r.get("action"),
        confirmed: r.get("confirmed"),
      })),
    );
    result.audit.push(
      ...audit.docs.map((a) => ({
        action: a.get("action"),
        ...a.get("changes"),
      })),
    );
  }
  result.students.sort((a, b) => a.id.localeCompare(b.id));
  result.tasks.sort((a, b) => a.id.localeCompare(b.id));
  result.work.sort((a, b) =>
    `${a.classId}:${a.studentId}:${a.taskId}`.localeCompare(
      `${b.classId}:${b.studentId}:${b.taskId}`,
    ),
  );
  return result;
}
function json(response: ServerResponse, code: number, value: unknown) {
  response.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Firebase-AppCheck",
  });
  response.end(JSON.stringify(value));
}
createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      json(response, 204, null);
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const path = request.url || "";
    if (path.startsWith("/__e2e/")) {
      const data = body.length ? JSON.parse(body.toString()) : {};
      const command = path.split("/").pop();
      let result: unknown;
      if (command === "health") {
        const checks = await Promise.all([
          fetch("http://127.0.0.1:8080"),
          fetch("http://127.0.0.1:9099"),
          fetch(
            `http://127.0.0.1:5001/${projectId}/asia-southeast1/getRetention`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: '{"data":{}}',
            },
          ),
        ]);
        if (checks[2].status === 404) {
          json(response, 503, { emulators: false, projectId });
          return;
        }
        result = { emulators: true, projectId };
      } else if (command === "seed") result = await seed(data);
      else if (command === "clock") {
        await clock(data.now);
        result = { ok: true };
      } else if (command === "snapshot") result = await snapshot();
      else if (command === "fault") {
        if (data.mode === "release") {
          fault = null;
          for (const release of held) release();
          held.clear();
        } else fault = data;
        result = { ok: true };
      } else if (command === "qr") {
        const students = await db.collectionGroup("students").get();
        const student = students.docs.find((s) => s.id === data.studentId)!;
        result = {
          payload: (
            await db.doc(`qrTokens/${student.get("currentQrId")}`).get()
          ).get("payload"),
        };
      } else {
        json(response, 404, {});
        return;
      }
      json(response, 200, result);
      return;
    }
    // A transport proxy injects failures around actual callable commits.
    const action = path.split("/").pop();
    const selected = fault?.action === action ? fault : null;
    if (selected?.mode === "before-commit") {
      json(response, 503, {
        error: { status: "UNAVAILABLE", message: "Lost request" },
      });
      return;
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5173",
    };
    if (request.headers.authorization)
      headers.Authorization = request.headers.authorization;
    const upstream = await fetch(`http://127.0.0.1:5001${path}`, {
      method: request.method,
      headers,
      ...(request.method === "POST" ? { body } : {}),
    });
    const payload = await upstream.text();
    if (selected?.mode === "after-commit") {
      json(response, 503, {
        error: { status: "UNAVAILABLE", message: "Lost reply" },
      });
      return;
    }
    // A release can arrive while the real callable is still finishing.
    if (selected?.mode === "hold-response" && fault === selected)
      await new Promise<void>((resolve) => held.add(resolve));
    response.writeHead(upstream.status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
    });
    response.end(payload);
  } catch {
    json(response, 500, { error: "Local harness operation failed" });
  }
}).listen(4400, "127.0.0.1", () =>
  console.log("E2E harness ready at http://127.0.0.1:4400"),
);
