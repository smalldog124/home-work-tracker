import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, BookOpen, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { useAuth } from "../auth/useAuth";
import { useClasses, useRetention, type ClassRecord } from "./api";
import { ClassForm } from "./ClassForm";
export function ClassCard({ record }: { record: ClassRecord }) {
  return (
    <Link
      className="class-card"
      to={`/classes/${record.id}`}
      data-testid={`class-card-${record.id}`}
    >
      <span className="class-icon">
        <BookOpen size={23} />
      </span>
      <ArrowUpRight className="card-arrow" size={20} />
      <h3>{record.subject}</h3>
      <p>{record.group}</p>
      <span className="caption">
        ปีการศึกษา {record.year} · ภาคเรียน {record.term}
      </span>
    </Link>
  );
}
export function ClassesPage() {
  const { user } = useAuth();
  const retention = useRetention();
  const key = `filters:${user!.uid}`;
  const [selection, setSelection] = useState<{ year?: number; term: number }>(
    () => {
      try {
        return JSON.parse(sessionStorage.getItem(key) || '{"term":1}');
      } catch {
        return { term: 1 };
      }
    },
  );
  const year = retention.data?.retainedYears.includes(selection.year || 0)
    ? selection.year!
    : retention.data?.currentYear || 0;
  const classes = useClasses(year, selection.term);
  const [adding, setAdding] = useState(false);
  function select(next: { year: number; term: number }) {
    setSelection(next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">วิชาและกลุ่มของคุณ</p>
          <h1>ห้องเรียน</h1>
          <p className="muted">เลือกปีและภาคเรียน เพื่อเปิดห้องที่ต้องการ</p>
        </div>
        <Button
          data-testid="add-class"
          onClick={() => setAdding(true)}
          disabled={!year}
        >
          <Plus size={20} />
          เพิ่มห้องเรียน
        </Button>
      </div>
      {retention.data?.notice && (
        <p className="notice" data-testid="expiry-notice">
          ข้อมูลปี {retention.data.notice.year} จะหมดอายุใน{" "}
          {retention.data.notice.days} วัน
        </p>
      )}
      <div className="filters">
        <label>
          ปีการศึกษา
          <select
            data-testid="school-year"
            value={year}
            onChange={(e) =>
              select({ year: Number(e.target.value), term: selection.term })
            }
          >
            {[...(retention.data?.retainedYears || [])].reverse().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          ภาคเรียน
          <select
            data-testid="term"
            value={selection.term}
            onChange={(e) => select({ year, term: Number(e.target.value) })}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            void retention.refetch();
            void classes.refetch();
          }}
        >
          รีเฟรช
        </Button>
      </div>
      {retention.isPending || classes.isPending ? (
        <LoadingState text="กำลังโหลดห้องเรียน…" />
      ) : retention.error || classes.error ? (
        <ErrorState
          testId="page-error"
          error={retention.error || classes.error}
          retry={() => {
            void retention.refetch();
            void classes.refetch();
          }}
        />
      ) : classes.data?.length ? (
        <>
          <p className="section-count">{classes.data.length} ห้องเรียน</p>
          <div className="class-grid">
            {classes.data.map((c) => (
              <ClassCard key={c.id} record={c} />
            ))}
          </div>
        </>
      ) : (
        <div className="empty">
          <BookOpen size={32} />
          <h2>ยังไม่มีห้องเรียนในภาคเรียนนี้</h2>
          <p className="muted">
            เพิ่มห้องเรียนเพื่อเริ่มจัดการรายชื่อและชิ้นงาน
          </p>
          <Button onClick={() => setAdding(true)}>เพิ่มห้องเรียน</Button>
        </div>
      )}
      {adding && (
        <ClassForm
          year={year}
          term={selection.term}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
