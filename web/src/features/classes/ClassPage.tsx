import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ScanLine } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { getClass, useRetention, type ClassRecord } from "./api";
import { getStudents } from "../students/api";
import { getTasks } from "../tasks/api";
import { getWorkList } from "../summary/api";
import { StudentsTab } from "../students/StudentsTab";
import { TasksTab } from "../tasks/TasksTab";
import { SummaryTab } from "../summary/SummaryTab";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
export function useClassData(classId: string) {
  const { user } = useAuth();
  const uid = user!.uid;
  const classroom = useQuery({
    queryKey: [uid, "class", classId],
    queryFn: () => getClass(uid, classId),
  });
  const students = useQuery({
    queryKey: [uid, "class", classId, "students"],
    queryFn: () => getStudents(uid, classId),
    enabled: Boolean(classroom.data),
  });
  const tasks = useQuery({
    queryKey: [uid, "class", classId, "tasks"],
    queryFn: () => getTasks(uid, classId),
    enabled: Boolean(classroom.data),
  });
  const work = useQuery({
    queryKey: [uid, "class", classId, "work"],
    queryFn: () => getWorkList(uid, classId),
    enabled: Boolean(classroom.data),
  });
  return { classroom, students, tasks, work };
}
export function rememberClass(uid: string, record: ClassRecord) {
  try {
    const records: ClassRecord[] = JSON.parse(
      sessionStorage.getItem(`recent:${uid}`) || "[]",
    );
    sessionStorage.setItem(
      `recent:${uid}`,
      JSON.stringify(
        [record, ...records.filter((c) => c.id !== record.id)].slice(0, 4),
      ),
    );
    sessionStorage.setItem(
      `filters:${uid}`,
      JSON.stringify({ year: record.year, term: record.term }),
    );
  } catch {
    /* Private browsing may disallow optional recent history. */
  }
}
export function ClassPage() {
  const { classId = "" } = useParams();
  const { user } = useAuth();
  const data = useClassData(classId);
  const retention = useRetention();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "summary";
  const [saved, setSaved] = useState("");
  useEffect(() => {
    if (data.classroom.data) rememberClass(user!.uid, data.classroom.data);
  }, [user, data.classroom.data]);
  if (data.classroom.isPending || retention.isPending)
    return <LoadingState text="กำลังโหลดห้องเรียน…" />;
  if (data.classroom.error || retention.error)
    return (
      <ErrorState
        error={data.classroom.error || retention.error}
        testId="page-error"
        retry={() => void data.classroom.refetch()}
      />
    );
  const classroom = data.classroom.data!;
  if (!retention.data?.retainedYears.includes(classroom.year))
    return (
      <ErrorState
        error={new Error("ข้อมูลปีการศึกษานี้หมดอายุแล้ว")}
        testId="page-error"
      />
    );
  const loading =
    data.students.isPending || data.tasks.isPending || data.work.isPending;
  const error = data.students.error || data.tasks.error || data.work.error;
  return (
    <>
      <Link className="back-link" to="/classes">
        <ArrowLeft size={18} />
        ห้องเรียนทั้งหมด
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ห้องเรียนของคุณ</p>
          <h1>
            {classroom.subject} <span className="muted">{classroom.group}</span>
          </h1>
          <p data-testid="class-context" className="muted">
            ปีการศึกษา {classroom.year} · ภาคเรียน {classroom.term}
          </p>
        </div>
        <Button asChild data-testid="scan-work">
          <Link to="/scan">
            <ScanLine size={20} />
            สแกนงาน
          </Link>
        </Button>
      </div>
      {retention.data.notice && (
        <p className="notice" data-testid="expiry-notice">
          ข้อมูลปี {retention.data.notice.year} จะหมดอายุใน{" "}
          {retention.data.notice.days} วัน
        </p>
      )}
      <nav className="tabs" aria-label="ข้อมูลห้องเรียน">
        {[
          { id: "summary", label: "สรุปการส่งงาน" },
          { id: "tasks", label: "ชิ้นงาน" },
          { id: "students", label: "นักเรียน" },
        ].map((t) => (
          <button
            key={t.id}
            data-testid={`tab-${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => {
              setParams({ tab: t.id });
              setSaved("");
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {saved && (
        <p
          className="success"
          role="status"
          data-testid="save-result"
          data-state="saved"
        >
          {saved}
        </p>
      )}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          error={error}
          testId="page-error"
          retry={() => {
            void data.students.refetch();
            void data.tasks.refetch();
            void data.work.refetch();
          }}
        />
      ) : tab === "students" ? (
        <StudentsTab
          classroom={classroom}
          students={data.students.data!}
          onSaved={setSaved}
        />
      ) : tab === "tasks" ? (
        <TasksTab
          classroom={classroom}
          tasks={data.tasks.data!}
          work={data.work.data!}
          onSaved={setSaved}
        />
      ) : (
        <SummaryTab
          classroom={classroom}
          students={data.students.data!}
          tasks={data.tasks.data!}
          work={data.work.data!}
          onSaved={setSaved}
        />
      )}
    </>
  );
}
