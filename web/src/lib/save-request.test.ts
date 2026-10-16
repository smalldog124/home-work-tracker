// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { createTaskSchema } from "@home-work/shared";
const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "a" } as { uid: string } | null },
  call: vi.fn(),
}));
vi.mock("./firebase", () => ({ auth: mocks.auth }));
vi.mock("./api", () => ({
  call: mocks.call,
  AccountChangedError: class extends Error {},
  reason: (e: { details?: { reason?: string } }) => e.details?.reason,
  uncertain: (e: { code?: string }) => e.code === "functions/unavailable",
}));
import { mutate } from "./save-request";
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.auth.currentUser = { uid: "a" };
});
it("retries a lost task save using the original ID and returns a confirmed result without creating another task", async () => {
  const first = {
    requestId: crypto.randomUUID(),
    classId: "c",
    name: "ชิ้นงานที่ 1",
  };
  mocks.call.mockRejectedValueOnce({ code: "functions/unavailable" });
  await expect(mutate("createTask", first, createTaskSchema)).rejects.toThrow(
    "ยังไม่ทราบผล",
  );
  mocks.call
    .mockResolvedValueOnce({ state: "unknown" })
    .mockResolvedValueOnce({ taskId: "t1" });
  await expect(
    mutate(
      "createTask",
      { ...first, requestId: crypto.randomUUID() },
      createTaskSchema,
    ),
  ).resolves.toEqual({ taskId: "t1" });
  expect(mocks.call.mock.calls[2][1]).toEqual(first);
});
it("blocks changed input while the old result is unknown and keeps account requests separate", async () => {
  const first = {
    requestId: crypto.randomUUID(),
    classId: "c",
    name: "งานเดิม",
  };
  mocks.call.mockRejectedValueOnce({ code: "functions/unavailable" });
  await expect(mutate("createTask", first, createTaskSchema)).rejects.toThrow();
  mocks.call.mockResolvedValueOnce({ state: "unknown" });
  await expect(
    mutate("createTask", { ...first, name: "งานใหม่" }, createTaskSchema),
  ).rejects.toThrow("รายการก่อนหน้า");
  mocks.auth.currentUser = { uid: "b" };
  mocks.call.mockResolvedValueOnce({ taskId: "b-task" });
  await mutate("createTask", first, createTaskSchema);
  expect(localStorage.getItem("pending-edit:a")).not.toBeNull();
  expect(localStorage.getItem("pending-edit:b")).toBeNull();
});

it("clears a definitively expired pending edit and allows a later new edit", async () => {
  const input = {
    requestId: crypto.randomUUID(),
    classId: "c",
    name: "งานเก่า",
  };
  mocks.call.mockRejectedValueOnce({ code: "functions/unavailable" });
  await expect(mutate("createTask", input, createTaskSchema)).rejects.toThrow();
  const expired = {
    code: "functions/failed-precondition",
    details: { reason: "YEAR_UNAVAILABLE" },
  };
  mocks.call.mockRejectedValueOnce(expired);
  await expect(mutate("createTask", input, createTaskSchema)).rejects.toEqual(
    expired,
  );
  expect(localStorage.getItem("pending-edit:a")).toBeNull();
  mocks.call.mockResolvedValueOnce({ taskId: "new-task" });
  await expect(
    mutate(
      "createTask",
      { ...input, classId: "new-class", requestId: crypto.randomUUID() },
      createTaskSchema,
    ),
  ).resolves.toEqual({ taskId: "new-task" });
});
it("retains the original pending ID when its result lookup fails transiently", async () => {
  const input = {
    requestId: crypto.randomUUID(),
    classId: "c",
    name: "งานเดิม",
  };
  mocks.call.mockRejectedValueOnce({ code: "functions/unavailable" });
  await expect(mutate("createTask", input, createTaskSchema)).rejects.toThrow();
  const stored = localStorage.getItem("pending-edit:a");
  mocks.call.mockRejectedValueOnce({ code: "functions/unavailable" });
  await expect(mutate("createTask", input, createTaskSchema)).rejects.toEqual({
    code: "functions/unavailable",
  });
  expect(localStorage.getItem("pending-edit:a")).toBe(stored);
});
