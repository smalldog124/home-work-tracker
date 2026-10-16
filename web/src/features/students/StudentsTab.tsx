import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ErrorState";
import { queryClient } from "@/lib/query-client";
import { newRequestId } from "@/lib/api";
import { useAuth } from "../auth/useAuth";
import type { ClassRecord } from "../classes/api";
import { QrDownload } from "../qr/QrDownload";
import { toggleStudent, type Student } from "./api";
import { StudentForm } from "./StudentForm";
import { ExcelReview } from "./ExcelReview";
export function StudentsTab({
  classroom,
  students,
  onSaved,
}: {
  classroom: ClassRecord;
  students: Student[];
  onSaved: (text: string) => void;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState<Student | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [toggle, setToggle] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [newQr, setNewQr] = useState<string>();
  async function changeActive() {
    if (!toggle) return;
    setBusy(true);
    setError(undefined);
    try {
      await toggleStudent({
        requestId: newRequestId(),
        classId: classroom.id,
        studentId: toggle.id,
        expectedVersion: toggle.version,
        active: !toggle.active,
        confirmed: true,
      });
      await queryClient.invalidateQueries({
        queryKey: [user!.uid, "class", classroom.id],
      });
      onSaved("บันทึกการใช้งานนักเรียนแล้ว");
      setToggle(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>
          รายชื่อนักเรียน{" "}
          <span className="count">
            {students.filter((s) => s.active).length} คน
          </span>
        </h2>
        <Button data-testid="add-student" onClick={() => setEditing("new")}>
          <Plus size={19} />
          เพิ่มนักเรียน
        </Button>
      </div>
      <div className="student-tools">
        <label className="checkbox-label">
          <input
            data-testid="show-inactive"
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          แสดงนักเรียนที่ปิดใช้งาน
        </label>
        <QrDownload
          classId={classroom.id}
          disabled={!students.some((s) => s.active)}
        />
      </div>
      {newQr && (
        <div className="notice">
          เลขที่เปลี่ยนแล้ว กรุณาใช้ QR ใหม่{" "}
          <QrDownload
            classId={classroom.id}
            studentId={newQr}
            testId="download-new-qr"
            label="ดาวน์โหลด QR ใหม่"
          />
        </div>
      )}
      {students.filter((s) => s.active || showInactive).length ? (
        <div className="student-list">
          {students
            .filter((s) => s.active || showInactive)
            .map((s) => (
              <div
                className="student-row"
                key={s.id}
                data-testid={`student-row-${s.id}`}
              >
                <span className="student-number">{s.number}</span>
                <div className="student-identity">
                  <strong>{s.name}</strong>
                  {!s.active && (
                    <span className="caption">
                      ปิดใช้งาน · เก็บประวัติเดิมไว้
                    </span>
                  )}
                </div>
                <div className="row-actions">
                  <Button
                    variant="ghost"
                    data-testid={`edit-student-${s.id}`}
                    onClick={() => setEditing(s)}
                  >
                    แก้ไข
                  </Button>
                  {s.active && (
                    <QrDownload classId={classroom.id} studentId={s.id} />
                  )}
                  <Button
                    variant="ghost"
                    data-testid={`toggle-student-${s.id}`}
                    onClick={() => {
                      setToggle(s);
                      setError(undefined);
                    }}
                  >
                    {s.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                  </Button>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="empty">
          <h3>ยังไม่มีนักเรียนที่เปิดใช้งาน</h3>
          <p>เพิ่มทีละคน หรือนำเข้ารายชื่อจาก Excel ด้านล่าง</p>
        </div>
      )}
      <ExcelReview
        classroom={classroom}
        students={students}
        onSaved={onSaved}
      />
      {editing && (
        <StudentForm
          classId={classroom.id}
          students={students}
          student={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(replaced) => {
            onSaved("บันทึกนักเรียนแล้ว");
            if (replaced && editing !== "new") setNewQr(editing.id);
          }}
        />
      )}
      {toggle && (
        <Panel
          title={toggle.active ? "ปิดใช้งานนักเรียน" : "เปิดใช้งานนักเรียน"}
          testId="confirm-student-toggle"
          onClose={() => setToggle(null)}
          locked={busy}
        >
          <p>{toggle.name}</p>
          <p className="muted">
            {toggle.active
              ? "ซ่อนจากรายชื่อและตารางปกติ QR จะหยุดใช้งาน แต่ยังเก็บประวัติงานไว้"
              : "QR ปัจจุบันจะใช้งานได้อีกครั้ง QR ที่เคยถูกเปลี่ยนยังใช้ไม่ได้"}
          </p>
          {error !== undefined && <ErrorState error={error} />}
          <div className="actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setToggle(null)}
            >
              ยกเลิก
            </Button>
            <Button disabled={busy} onClick={() => void changeActive()}>
              {busy ? "กำลังบันทึก…" : "ยืนยัน"}
            </Button>
          </div>
        </Panel>
      )}
    </>
  );
}
