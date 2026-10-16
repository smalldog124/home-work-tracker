import { useState } from "react";
import { STATUS_LABELS } from "@home-work/shared";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { thaiDate } from "@/lib/date";
import type { ResolvedQr } from "./api";
import type { WorkStatus } from "../summary/api";
export function PastWorkPanel({
  data,
  status,
  busy,
  pending,
  error,
  onSave,
  onClose,
  onRecover,
}: {
  data: ResolvedQr;
  status: WorkStatus;
  busy: boolean;
  pending: boolean;
  error: string;
  onSave: (id: string) => void;
  onClose: () => void;
  onRecover: () => void;
}) {
  const [task, setTask] = useState("");
  return (
    <Panel
      title="บันทึกงานย้อนหลัง"
      testId="past-work-panel"
      onClose={onClose}
      locked={busy || pending}
    >
      <p>
        <strong>
          เลขที่ {data.student.number} · {data.student.name}
        </strong>
      </p>
      <p className="muted">
        {data.class.subject} · {data.class.group} · ปี {data.class.year} ·
        ภาคเรียน {data.class.term}
      </p>
      <p className="notice">
        สถานะที่จะบันทึก: {STATUS_LABELS[status]} ใช้วันที่บันทึกตามเวลาไทย
      </p>
      <div className="past-tasks">
        {data.tasks.map((t) => (
          <div key={t.id} data-testid="past-task" data-task-id={t.id}>
            <Button
              variant={task === t.id ? "default" : "outline"}
              data-testid={`choose-task-${t.id}`}
              disabled={busy || pending || !t.selectable}
              onClick={() => setTask(t.id)}
            >
              {t.name}
              <span>
                {t.selectable
                  ? "ยังไม่ส่ง"
                  : `${STATUS_LABELS[t.status]} · ${thaiDate(t.savedAt)}`}
              </span>
            </Button>
          </div>
        ))}
      </div>
      {!data.tasks.length && (
        <p className="notice">ห้องนี้ยังไม่มีชิ้นงาน กรุณาเพิ่มชิ้นงานก่อน</p>
      )}
      {error && (
        <p role="alert" className="error" data-testid="past-work-error">
          {error}
        </p>
      )}
      {pending && (
        <div className="notice" role="status">
          <p>ยังไม่ทราบผลการบันทึก กรุณาตรวจสอบผลก่อนสแกนคนถัดไป</p>
          <Button
            variant="outline"
            disabled={busy || !navigator.onLine}
            onClick={onRecover}
          >
            ตรวจสอบผลบันทึก
          </Button>
        </div>
      )}
      <div className="actions">
        <Button variant="outline" disabled={busy || pending} onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          data-testid="confirm-past-work"
          disabled={!task || busy || pending}
          onClick={() => onSave(task)}
        >
          {busy ? "กำลังตรวจสอบ…" : "ยืนยันบันทึก"}
        </Button>
      </div>
    </Panel>
  );
}
