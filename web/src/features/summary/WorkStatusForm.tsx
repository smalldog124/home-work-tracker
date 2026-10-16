import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WORK_STATUSES, STATUS_LABELS } from "@home-work/shared";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { newRequestId } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { thaiDate } from "@/lib/date";
import { useAuth } from "../auth/useAuth";
import type { Student } from "../students/api";
import type { Task } from "../tasks/api";
import { changeWorkStatus, getWork, type WorkStatus } from "./api";
export function WorkStatusForm({
  classId,
  student,
  task,
  onClose,
  onSaved,
}: {
  classId: string;
  student: Student;
  task: Task;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const ref = { classId, studentId: student.id, taskId: task.id };
  const current = useQuery({
    queryKey: [user!.uid, "work-form", classId, student.id, task.id],
    queryFn: () => getWork(ref),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [status, setStatus] = useState<WorkStatus>();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const selected = status || current.data?.status || "not-sent";
  async function save(confirmed = false) {
    if (!current.data) return;
    if (selected === "not-sent" && !confirmed) {
      setConfirm(true);
      return;
    }
    setConfirm(false);
    setBusy(true);
    setError(undefined);
    try {
      await changeWorkStatus({
        requestId: newRequestId(),
        ...ref,
        expectedVersion: current.data.version,
        status: selected,
        confirmClear: confirmed,
      });
      await queryClient.invalidateQueries({
        queryKey: [user!.uid, "class", classId],
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Panel
        title="แก้ไขสถานะงาน"
        testId="work-panel"
        closeTestId="close-work-panel"
        onClose={onClose}
        locked={busy}
      >
        <div className="work-details">
          <strong>
            เลขที่ {student.number} · {student.name}
          </strong>
          <p>{task.name}</p>
        </div>
        {current.isPending ? (
          <LoadingState text="กำลังตรวจสอบสถานะล่าสุด…" />
        ) : current.error ? (
          <ErrorState
            error={current.error}
            retry={() => void current.refetch()}
          />
        ) : (
          <>
            <p className="muted">
              สถานะเดิม: {STATUS_LABELS[current.data.status]} · วันที่{" "}
              {thaiDate(current.data.savedAt)}
            </p>
            <label>
              สถานะใหม่
              <select
                data-testid="work-status"
                value={selected}
                disabled={busy}
                onChange={(e) => setStatus(e.target.value as WorkStatus)}
              >
                {WORK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <p className="notice">
              {selected === "not-sent"
                ? "วันที่ส่งจะถูกล้าง ต้องยืนยันก่อนบันทึก"
                : current.data.savedAt
                  ? "เก็บวันที่ส่งเดิมไว้ เปลี่ยนเฉพาะสถานะ"
                  : "ใช้วันที่บันทึกครั้งนี้ตามเวลาไทย"}
            </p>
            {error !== undefined && (
              <ErrorState
                error={error}
                retry={() => {
                  void current.refetch();
                  setError(undefined);
                }}
              />
            )}
            <div className="actions">
              <Button variant="outline" onClick={onClose} disabled={busy}>
                ยกเลิก
              </Button>
              <Button
                data-testid="save-work-status"
                disabled={busy || current.isFetching}
                onClick={() => void save()}
              >
                {busy ? "กำลังบันทึก…" : "บันทึกสถานะ"}
              </Button>
            </div>
          </>
        )}
      </Panel>
      {confirm && (
        <Panel
          title="เปลี่ยนเป็นยังไม่ส่ง"
          testId="confirm-clear-work"
          onClose={() => setConfirm(false)}
        >
          <p>วันที่ส่งจะถูกล้าง ประวัติการเปลี่ยนแปลงยังคงอยู่</p>
          <div className="actions">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              ยกเลิก
            </Button>
            <Button onClick={() => void save(true)}>ยืนยัน</Button>
          </div>
        </Panel>
      )}
    </>
  );
}
