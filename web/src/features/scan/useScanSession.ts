import { useCallback, useEffect, useRef, useState } from "react";
import { STATUS_LABELS, type ScanInput } from "@home-work/shared";
import { auth } from "@/lib/firebase";
import {
  AccountChangedError,
  message,
  newRequestId,
  reason,
  uncertain,
} from "@/lib/api";
import { thaiDate } from "@/lib/date";
import { queryClient } from "@/lib/query-client";
import type { WorkResult } from "../summary/api";
import {
  getRequestResult,
  resolveQr,
  savePastWork,
  saveWork,
  type ResolvedQr,
} from "./api";
import {
  clearPending,
  persistPending,
  readPending,
  type PendingRequest,
} from "./pending-request";
import { playScanSound } from "./sounds";
export const LATE_RANGES = {
  "late-1": "2–3 วัน",
  "late-2": "3–7 วัน",
  "late-3": "7–14 วัน",
  "late-4": "มากกว่า 14 วัน",
};
export function useScanSession(uid: string) {
  const [status, setStatus] = useState<ScanInput["status"]>("on-time");
  const [mode, setMode] = useState<"normal" | "past">("normal");
  const [pending, setPending] = useState<PendingRequest | null>(() =>
    readPending(uid),
  );
  const pendingRef = useRef(pending);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const [result, setResult] = useState<{
    state: "saved" | "error";
    text: string;
    classId?: string;
  }>();
  const [past, setPast] = useState<{ payload: string; data: ResolvedQr }>();
  const [pastError, setPastError] = useState("");
  const currentAccount = () => alive.current && auth.currentUser?.uid === uid;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const sound = playScanSound;
  function confirmed(saved: WorkResult) {
    if (!currentAccount()) return;
    clearPending(uid);
    pendingRef.current = null;
    setPending(null);
    setPast(undefined);
    setPastError("");
    setResult({ state: "saved", text: STATUS_LABELS[saved.status] });
    sound("success");
    void queryClient.invalidateQueries({ queryKey: [uid] });
  }
  function failed(error: unknown, request?: PendingRequest) {
    if (!currentAccount() || error instanceof AccountChangedError) return;
    if (request && uncertain(error)) {
      setResult(undefined);
      return;
    }
    if (request) {
      clearPending(uid);
      pendingRef.current = null;
      setPending(null);
    }
    const detail = (
      error as {
        details?: {
          status?: WorkResult["status"];
          savedAt?: string;
          classId?: string;
        };
      }
    )?.details;
    const text =
      reason(error) === "ALREADY_SENT" && detail?.status
        ? `${message(error)} · ${thaiDate(detail.savedAt || null)} · ${STATUS_LABELS[detail.status]}`
        : message(error);
    setResult({
      state: "error",
      text,
      classId: reason(error) === "NO_TASK" ? detail?.classId : undefined,
    });
    if (past || request?.action === "savePastWork") setPastError(text);
    sound("error");
  }
  async function send(request: PendingRequest) {
    if (lock.current || !currentAccount() || pendingRef.current) return;
    try {
      persistPending(uid, request);
    } catch (e) {
      failed(e);
      return;
    }
    lock.current = true;
    setBusy(true);
    pendingRef.current = request;
    setPending(request);
    setResult(undefined);
    try {
      confirmed(
        await (request.action === "saveWork"
          ? saveWork(request.input)
          : savePastWork(request.input)),
      );
    } catch (e) {
      failed(e, request);
    } finally {
      lock.current = false;
      if (currentAccount()) setBusy(false);
    }
  }
  const recover = useCallback(async () => {
    const request = pendingRef.current;
    if (!request || lock.current || !navigator.onLine || !currentAccount())
      return;
    lock.current = true;
    setBusy(true);
    try {
      const lookup = await getRequestResult(request.input.requestId);
      if (!currentAccount()) return;
      if (lookup.state === "confirmed") {
        if (lookup.action !== request.action)
          throw new Error("ไม่สามารถตรวจสอบคำขอบันทึกนี้ได้");
        confirmed(lookup.result);
      } else
        confirmed(
          await (request.action === "saveWork"
            ? saveWork(request.input)
            : savePastWork(request.input)),
        );
    } catch (e) {
      failed(e, request);
    } finally {
      lock.current = false;
      if (currentAccount()) setBusy(false);
    }
  }, [uid]);
  useEffect(() => {
    void recover();
    const resume = () => {
      if (document.visibilityState === "visible") void recover();
    };
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [recover]);
  async function read(payload: string) {
    if (lock.current || pendingRef.current || past || !navigator.onLine) return;
    if (mode === "normal") {
      await send({
        action: "saveWork",
        input: { requestId: newRequestId(), payload, status },
      });
      return;
    }
    lock.current = true;
    setBusy(true);
    setPastError("");
    try {
      const data = await resolveQr(payload);
      if (currentAccount()) setPast({ payload, data });
    } catch (e) {
      failed(e);
    } finally {
      lock.current = false;
      if (currentAccount()) setBusy(false);
    }
  }
  async function confirmPast(taskId: string) {
    if (!past) return;
    await send({
      action: "savePastWork",
      input: {
        requestId: newRequestId(),
        payload: past.payload,
        status,
        taskId,
        confirmed: true,
      },
    });
  }
  return {
    status,
    setStatus,
    mode,
    setMode,
    pending,
    busy,
    result,
    past,
    pastError,
    read,
    recover,
    confirmPast,
    closePast: () => {
      if (!pendingRef.current && !lock.current) setPast(undefined);
    },
  };
}
