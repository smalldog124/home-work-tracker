import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ErrorState";
import { newRequestId, reason } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { download } from "../qr/download";
import { useAuth } from "../auth/useAuth";
import type { ClassRecord } from "../classes/api";
import { importStudents, type Student } from "./api";
import {
  readExcel,
  excelTemplate,
  reviewRows,
  type ReviewRow,
  type RowKind,
} from "./excel";
const labels: Record<RowKind, string> = {
  new: "เพิ่มใหม่",
  changed: "เปลี่ยนชื่อ",
  unchanged: "ไม่เปลี่ยน",
  invalid: "ต้องแก้ไข",
};
export function ExcelReview({
  classroom,
  students,
  onSaved,
}: {
  classroom: ClassRecord;
  students: Student[];
  onSaved: (text: string) => void;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [rosterVersion, setRosterVersion] = useState(classroom.rosterVersion);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [conflict, setConflict] = useState(false);
  const reviewed = reviewRows(rows || [], students);
  function edit(id: number, field: "number" | "name", value: string) {
    setRows((previous) =>
      previous!.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }
  async function read(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    setResult("");
    setRows(null);
    setConflict(false);
    try {
      setRows(await readExcel(file));
      setRosterVersion(classroom.rosterVersion);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await importStudents({
        requestId: newRequestId(),
        classId: classroom.id,
        expectedRosterVersion: rosterVersion,
        rows: reviewed.map((r) => ({ number: r.number, name: r.name })),
      });
      await queryClient.invalidateQueries({
        queryKey: [user!.uid, "class", classroom.id],
      });
      const text = `บันทึกแล้ว เพิ่ม ${result.added} คน เปลี่ยนชื่อ ${result.changed} คน ไม่เปลี่ยน ${result.unchanged} คน`;
      setResult(text);
      setRows(null);
      onSaved(text);
    } catch (e) {
      setError(e);
      if (reason(e) === "VERSION_CONFLICT") {
        setConflict(true);
        await queryClient.invalidateQueries({
          queryKey: [user!.uid, "class", classroom.id],
        });
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="excel-section">
      <h3>นำเข้ารายชื่อจาก Excel</h3>
      <p className="muted">
        {classroom.subject} · {classroom.group} · ปี {classroom.year} · ภาคเรียน{" "}
        {classroom.term}
      </p>
      <p className="caption">
        ตรวจและแก้ไขรายชื่อก่อนบันทึก สูงสุด 200 คน ไฟล์ .xlsx ไม่เกิน 5 MB
      </p>
      <div className="actions start">
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            try {
              download(
                await excelTemplate(),
                "รายชื่อนักเรียน-ตัวอย่าง.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              );
            } catch (e) {
              setError(e);
            }
          }}
        >
          ดาวน์โหลดไฟล์ตัวอย่าง
        </Button>
        <label className="file-button">
          เลือกไฟล์ Excel
          <input
            type="file"
            accept=".xlsx"
            data-testid="excel-file"
            disabled={busy}
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {busy && <p role="status">กำลังดำเนินการ…</p>}
      {error !== undefined && (
        <ErrorState
          testId={
            reason(error) === "VERSION_CONFLICT"
              ? "version-conflict"
              : "import-error"
          }
          error={error}
        />
      )}
      {conflict && (
        <Button
          variant="outline"
          onClick={() => {
            setRosterVersion(classroom.rosterVersion);
            setConflict(false);
            setError(undefined);
          }}
        >
          ตรวจสอบรายชื่อกับข้อมูลล่าสุดแล้ว
        </Button>
      )}
      {result && (
        <p
          role="status"
          className="success"
          data-testid="import-result"
          data-state="saved"
        >
          {result}
        </p>
      )}
      {rows && (
        <>
          <div className="import-counts">
            {(Object.keys(labels) as RowKind[]).map((kind) => (
              <span key={kind}>
                {labels[kind]}{" "}
                <strong data-testid={`import-count-${kind}`}>
                  {reviewed.filter((r) => r.kind === kind).length}
                </strong>
              </span>
            ))}
          </div>
          <div className="review-scroll">
            <table>
              <thead>
                <tr>
                  <th>แถว</th>
                  <th>เลขที่</th>
                  <th>ชื่อ-นามสกุล</th>
                  <th>ผลตรวจ</th>
                  <th>นำออก</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id + 2}</td>
                    <td>
                      <input
                        aria-label={`เลขที่ แถว ${r.id + 2}`}
                        data-testid={`import-number-${r.id}`}
                        value={r.number}
                        disabled={busy}
                        onChange={(e) => edit(r.id, "number", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`ชื่อ แถว ${r.id + 2}`}
                        data-testid={`import-name-${r.id}`}
                        value={r.name}
                        disabled={busy}
                        onChange={(e) => edit(r.id, "name", e.target.value)}
                      />
                    </td>
                    <td>
                      <span
                        className={r.kind === "invalid" ? "field-error" : ""}
                      >
                        {labels[r.kind]}
                      </span>
                      {r.errors.map((e) => (
                        <p className="field-error" key={e}>
                          {e}
                        </p>
                      ))}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        data-testid={`import-remove-${r.id}`}
                        onClick={() =>
                          setRows(rows.filter((row) => row.id !== r.id))
                        }
                      >
                        นำแถวออก
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="notice">
            จับคู่ตามเลขที่ เก็บนักเรียนที่ไม่ได้อยู่ในไฟล์และประวัติงานเดิมไว้
            หากต้องการเปลี่ยนเลขที่ของคนเดิมให้ใช้ฟอร์มแก้ไขนักเรียน
          </p>
          <div className="actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setRows(null)}
            >
              ยกเลิก
            </Button>
            <Button
              data-testid="save-import"
              disabled={
                busy ||
                conflict ||
                !reviewed.length ||
                reviewed.some((r) => r.kind === "invalid")
              }
              onClick={() => void save()}
            >
              บันทึกรายชื่อ
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
