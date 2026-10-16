import { useState } from "react";
import { studentNumber, text } from "@home-work/shared";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ErrorState";
import { newRequestId } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { useAuth } from "../auth/useAuth";
import { addStudent, updateStudent, type Student } from "./api";
export function StudentForm({
  classId,
  students,
  student,
  onClose,
  onSaved,
}: {
  classId: string;
  students: Student[];
  student?: Student;
  onClose: () => void;
  onSaved: (qrReplaced: boolean) => void;
}) {
  const { user } = useAuth();
  const [number, setNumber] = useState(String(student?.number || ""));
  const [name, setName] = useState(student?.name || "");
  const [numberError, setNumberError] = useState("");
  const [nameError, setNameError] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  async function save(confirmed = false) {
    setError(undefined);
    setNumberError("");
    setNameError("");
    const num = studentNumber.safeParse(number);
    const fullName = text.safeParse(name);
    if (!num.success)
      setNumberError("กรอกเลขที่เป็นจำนวนเต็มตั้งแต่ 1 ถึง 999999");
    else if (
      students.some((s) => s.number === num.data && s.id !== student?.id)
    ) {
      setNumberError("เลขที่นี้ถูกใช้แล้ว รวมถึงนักเรียนที่ปิดใช้งาน");
      return;
    }
    if (!fullName.success)
      setNameError("กรอกชื่อ-นามสกุลเป็นข้อความธรรมดาไม่เกิน 200 ตัวอักษร");
    if (!num.success || !fullName.success) return;
    if (student && num.data !== student.number && !confirmed) {
      setConfirm(true);
      return;
    }
    setConfirm(false);
    setBusy(true);
    try {
      const input = {
        requestId: newRequestId(),
        classId,
        number: num.data,
        name: fullName.data,
      };
      const result = student
        ? await updateStudent({
            ...input,
            studentId: student.id,
            expectedVersion: student.version,
            confirmNumberChange: confirmed,
          })
        : await addStudent(input);
      await queryClient.invalidateQueries({
        queryKey: [user!.uid, "class", classId],
      });
      onSaved("qrReplaced" in result && result.qrReplaced === true);
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
        title={student ? "แก้ไขนักเรียน" : "เพิ่มนักเรียน"}
        onClose={onClose}
        locked={busy}
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            เลขที่
            <input
              data-testid="student-number"
              inputMode="numeric"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              autoFocus
              aria-invalid={Boolean(numberError)}
            />
          </label>
          {numberError && (
            <p className="field-error" data-testid="student-number-error">
              {numberError}
            </p>
          )}
          <label>
            ชื่อ-นามสกุล
            <input
              data-testid="student-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              aria-invalid={Boolean(nameError)}
            />
          </label>
          {nameError && (
            <p className="field-error" data-testid="student-name-error">
              {nameError}
            </p>
          )}
          {student && (
            <p className="notice">
              เปลี่ยนชื่อได้โดยใช้ QR เดิม การเปลี่ยนเลขที่ต้องออก QR
              ใหม่และเก็บประวัติงานเดิมไว้
            </p>
          )}
          {error !== undefined && (
            <ErrorState
              error={error}
              retry={() => {
                void queryClient.invalidateQueries({
                  queryKey: [user!.uid, "class", classId],
                });
                onClose();
              }}
            />
          )}
          <div className="actions">
            <Button
              type="button"
              variant="outline"
              data-testid="cancel-student"
              onClick={onClose}
              disabled={busy}
            >
              ยกเลิก
            </Button>
            <Button data-testid="save-student" disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึกนักเรียน"}
            </Button>
          </div>
        </form>
      </Panel>
      {confirm && (
        <Panel
          title="ยืนยันการเปลี่ยนเลขที่"
          testId="confirm-number-change"
          onClose={() => setConfirm(false)}
        >
          <p>
            QR เดิมจะหยุดใช้งาน ต้องดาวน์โหลด QR ใหม่ ประวัติการส่งงานยังคงอยู่
          </p>
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
