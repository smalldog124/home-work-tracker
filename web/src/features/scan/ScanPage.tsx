import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  SENT_STATUSES,
  STATUS_LABELS,
  type ScanInput,
} from "@home-work/shared";
import { useAuth } from "../auth/useAuth";
import { Button } from "@/components/ui/button";
import { QrCamera } from "./QrCamera";
import { PastWorkPanel } from "./PastWorkPanel";
import { LATE_RANGES, useScanSession } from "./useScanSession";
export function ScanPage() {
  const { user } = useAuth();
  const session = useScanSession(user!.uid);
  const [online, setOnline] = useState(navigator.onLine);
  const [visible, setVisible] = useState(
    document.visibilityState === "visible",
  );
  const [cameraVersion, setCameraVersion] = useState(0);
  useEffect(() => {
    const network = () => setOnline(navigator.onLine);
    const visibility = () => {
      setVisible(document.visibilityState === "visible");
      setOnline(navigator.onLine);
    };
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <div className="scan-page">
      <QrCamera
        key={cameraVersion}
        onRead={(payload) => void session.read(payload)}
        paused={
          !online || session.busy || Boolean(session.pending || session.past)
        }
        enabled={online && visible}
      />
      {session.pending ? (
        <div
          className="scan-result"
          data-testid="scan-result"
          data-state="pending"
          role="status"
        >
          ยังไม่ทราบผลการบันทึก กรุณารอการยืนยัน
        </div>
      ) : session.result ? (
        <div
          className={`scan-result ${session.result.state}`}
          data-testid="scan-result"
          data-state={session.result.state}
          role="status"
        >
          {session.result.text}
        </div>
      ) : (
        !session.pending && (
          <p className="muted scan-idle">ผลสแกนล่าสุดจะแสดงที่นี่</p>
        )
      )}
      {session.result?.classId && (
        <Button asChild data-testid="scan-add-task">
          <Link to={`/classes/${session.result.classId}?tab=tasks&add=1`}>
            เพิ่มชิ้นงาน
          </Link>
        </Button>
      )}
      <div className="page-heading">
        <div>
          <p className="eyebrow">บันทึกด้วย QR</p>
          <h1>สแกนงาน</h1>
          <p className="muted">QR จะระบุห้องเรียนให้อัตโนมัติ</p>
        </div>
      </div>
      <div className="scan-modes" aria-label="โหมดการสแกน">
        <button
          data-testid="scan-mode-normal"
          aria-pressed={session.mode === "normal"}
          disabled={session.busy || Boolean(session.pending)}
          onClick={() => session.setMode("normal")}
        >
          ปกติ · ชิ้นงานล่าสุด
        </button>
        <button
          data-testid="scan-mode-past"
          aria-pressed={session.mode === "past"}
          disabled={session.busy || Boolean(session.pending)}
          onClick={() => session.setMode("past")}
        >
          งานย้อนหลัง
        </button>
      </div>
      <div className={`scan-status ${session.status}`}>
        <label>
          สถานะที่จะบันทึก
          <select
            data-testid="work-status"
            value={session.status}
            disabled={session.busy || Boolean(session.pending)}
            onChange={(e) =>
              session.setStatus(e.target.value as ScanInput["status"])
            }
          >
            {SENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        {session.status !== "on-time" && (
          <p data-testid="late-range">
            {LATE_RANGES[session.status]} · ครูเป็นผู้เลือกระดับ
          </p>
        )}
      </div>
      {!online && (
        <div className="error" data-testid="network-error" role="alert">
          ไม่มีอินเทอร์เน็ต กรุณาเชื่อมต่ออีกครั้งก่อนสแกน
        </div>
      )}
      <Button
        variant="ghost"
        data-testid="resume-scan"
        disabled={!online || session.busy}
        onClick={() => {
          setCameraVersion((v) => v + 1);
          void session.recover();
        }}
      >
        ตรวจสอบการเชื่อมต่อและเปิดกล้องใหม่
      </Button>
      {session.pending && (
        <div className="notice" role="status" data-testid="pending-save">
          <strong>
            {session.busy
              ? "กำลังตรวจสอบผลการบันทึก…"
              : "ยังไม่ทราบผลการบันทึก กำลังรอตรวจสอบ"}
          </strong>
          <p>พักการสแกนจนกว่าจะยืนยันผลได้</p>
          <Button
            variant="outline"
            data-testid="check-save-result"
            disabled={session.busy || !online}
            onClick={() => void session.recover()}
          >
            ตรวจสอบผลบันทึก
          </Button>
        </div>
      )}
      {session.past && (
        <PastWorkPanel
          key={session.past.payload}
          data={session.past.data}
          status={session.status}
          busy={session.busy}
          pending={Boolean(session.pending)}
          error={session.pastError}
          onSave={(id) => void session.confirmPast(id)}
          onClose={session.closePast}
          onRecover={() => void session.recover()}
        />
      )}
    </div>
  );
}
