// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "a" } as { uid: string } | null },
  save: vi.fn(),
  pastSave: vi.fn(),
  lookup: vi.fn(),
  resolve: vi.fn(),
  invalidate: vi.fn(),
  play: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({ auth: mocks.auth }));
vi.mock("@/lib/query-client", () => ({
  queryClient: { invalidateQueries: mocks.invalidate },
}));
vi.mock("./api", () => ({
  saveWork: mocks.save,
  savePastWork: mocks.pastSave,
  getRequestResult: mocks.lookup,
  resolveQr: mocks.resolve,
}));
import { useScanSession } from "./useScanSession";
import { persistPending, readPending } from "./pending-request";
const saved = {
  status: "on-time",
  savedAt: "2026-10-10T05:00:00Z",
  version: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.auth.currentUser = { uid: "a" };
  mocks.invalidate.mockResolvedValue(undefined);
  vi.stubGlobal(
    "Audio",
    class {
      play = mocks.play.mockResolvedValue(undefined);
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps the original request after a lost reply and blocks the next scan", async () => {
  mocks.save
    .mockRejectedValueOnce({ code: "functions/unavailable" })
    .mockResolvedValue(saved);
  mocks.lookup.mockResolvedValue({ state: "unknown" });
  const { result } = renderHook(() => useScanSession("a"));
  await act(async () => {
    await result.current.read("qr-a");
  });
  const pending = readPending("a")!;
  expect(pending.input.payload).toBe("qr-a");
  expect(result.current.result).toBeUndefined();
  expect(mocks.play).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.read("qr-b");
  });
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await act(async () => {
    await result.current.recover();
  });
  expect(mocks.save.mock.calls[1][0]).toEqual(pending.input);
  expect(result.current.result).toEqual({ state: "saved", text: "ส่งตรงเวลา" });
  expect(readPending("a")).toBeNull();
  expect(mocks.play).toHaveBeenCalledTimes(1);
});
it("checks a persisted confirmed request after reload without making a new save", async () => {
  const request = {
    action: "saveWork" as const,
    input: {
      requestId: crypto.randomUUID(),
      payload: "qr-a",
      status: "on-time" as const,
    },
  };
  persistPending("a", request);
  mocks.lookup.mockResolvedValue({
    state: "confirmed",
    action: "saveWork",
    result: saved,
  });
  const { result } = renderHook(() => useScanSession("a"));
  await waitFor(() => expect(result.current.result?.state).toBe("saved"));
  expect(mocks.lookup).toHaveBeenCalledWith(request.input.requestId);
  expect(mocks.save).not.toHaveBeenCalled();
});
it("isolates pending data and ignores a delayed response for the old account", async () => {
  let resolve!: (value: unknown) => void;
  mocks.save.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const first = renderHook(() => useScanSession("a"));
  let operation!: Promise<void>;
  act(() => {
    operation = first.result.current.read("qr-a");
  });
  expect(readPending("a")).not.toBeNull();
  expect(readPending("b")).toBeNull();
  first.unmount();
  mocks.auth.currentUser = { uid: "b" };
  const second = renderHook(() => useScanSession("b"));
  await act(async () => {
    resolve(saved);
    await operation;
  });
  expect(second.result.current.result).toBeUndefined();
  expect(second.result.current.pending).toBeNull();
  expect(mocks.play).not.toHaveBeenCalled();
});
it("keeps scan status across modes and clears it on a new scan page session", async () => {
  const first = renderHook(() => useScanSession("a"));
  act(() => {
    first.result.current.setStatus("late-2");
    first.result.current.setMode("past");
  });
  expect(first.result.current.status).toBe("late-2");
  first.unmount();
  const next = renderHook(() => useScanSession("a"));
  expect(next.result.current.status).toBe("on-time");
});
