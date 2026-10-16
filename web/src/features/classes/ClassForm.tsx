import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { newRequestId, reason } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ErrorState";
import { useAuth } from "../auth/useAuth";
import { createClass, getClasses, getSubjects } from "./api";
import { usePlan } from "../plans/api";
import { PlanSummary } from "../plans/PlanSummary";
export function ClassForm({
  year,
  term,
  onClose,
}: {
  year: number;
  term: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const plan = usePlan();
  const navigate = useNavigate();
  const { data: subjects } = useQuery({
    queryKey: [user!.uid, "subjects"],
    queryFn: () => getSubjects(user!.uid),
  });
  const [subject, setSubject] = useState("");
  const [group, setGroup] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      const existing = await getClasses(user!.uid, year, term);
      if (
        existing.some(
          (c) => c.subject === subject.trim() && c.group === group.trim(),
        )
      )
        throw new Error(
          "ห้องเรียนซ้ำ มีวิชาและกลุ่มนี้ในปีและภาคเรียนที่เลือกแล้ว",
        );
      const result = await createClass({
        requestId: newRequestId(),
        year,
        term,
        subject,
        group,
      });
      await queryClient.invalidateQueries({ queryKey: [user!.uid] });
      navigate(`/classes/${result.classId}`);
    } catch (e) {
      setError(e);
      if (reason(e) === 'CLASSROOM_LIMIT') await plan.refetch();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="เพิ่มห้องเรียน" onClose={onClose} locked={busy}>
      <p className="muted">
        ปีการศึกษา {year} · ภาคเรียน {term}
      </p>
      <p>ห้องเรียน {plan.data?.classroomCount ?? "…"} / {plan.data?.classroomLimit ?? "Unlimited"}</p>
      <form onSubmit={save}>
        <label>
          ชื่อวิชา
          <input
            data-testid="subject-name"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            list="subjects"
            required
            maxLength={200}
            autoFocus
            placeholder="เช่น คณิตศาสตร์"
          />
        </label>
        <datalist id="subjects">
          {subjects?.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
        <label>
          กลุ่ม / ห้อง
          <input
            data-testid="group-name"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            required
            maxLength={200}
            placeholder="เช่น ม.1/1"
          />
        </label>
        <p className="notice">
          ตรวจสอบ: {subject || "ชื่อวิชา"} · {group || "กลุ่ม / ห้อง"} · ปี {year} ภาคเรียน {term} เมื่อสร้างแล้วจะเปลี่ยนปี ภาคเรียน วิชา และกลุ่มไม่ได้
        </p>
        {error !== undefined && <ErrorState error={error} />}
        {reason(error) === 'CLASSROOM_LIMIT' && plan.data && <PlanSummary plan={plan.data} />}
        <div className="actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            ยกเลิก
          </Button>
          <Button data-testid="save-class" disabled={busy}>
            {busy ? "กำลังบันทึก…" : "สร้างห้องเรียน"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
