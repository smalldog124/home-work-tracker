import { useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/query-client";
import { useAuth } from "../auth/useAuth";
import type { ClassRecord } from "../classes/api";
import type { Student } from "../students/api";
import type { Task } from "../tasks/api";
import { Button } from "@/components/ui/button";
import type { WorkRecord } from "./api";
import { WorkTable } from "./WorkTable";
import { WorkStatusForm } from "./WorkStatusForm";
export function SummaryTab({
  classroom,
  students,
  tasks,
  work,
  onSaved,
}: {
  classroom: ClassRecord;
  students: Student[];
  tasks: Task[];
  work: WorkRecord[];
  onSaved: (text: string) => void;
}) {
  const { user } = useAuth();
  const [showInactive, setShowInactive] = useState(false);
  const [selection, setSelection] = useState<{
    student: Student;
    task: Task;
  }>();
  const [refreshing, setRefreshing] = useState(false);
  const visible = students.filter((s) => s.active || showInactive);
  const complete = visible.filter(
    (s) =>
      tasks.length > 0 &&
      tasks.every((t) =>
        work.some((w) => w.studentId === s.id && w.taskId === t.id),
      ),
  ).length;
  return (
    <>
      <div className="section-heading">
        <h2>ภาพรวมการส่งงาน</h2>
        <Button
          variant="outline"
          data-testid="refresh-summary"
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true);
            try {
              await queryClient.invalidateQueries({
                queryKey: [user!.uid, "class", classroom.id],
              });
            } finally {
              setRefreshing(false);
            }
          }}
        >
          <RefreshCw size={18} />
          {refreshing ? "กำลังโหลด…" : "รีเฟรช"}
        </Button>
      </div>
      <div className="summary-stats">
        <div>
          <span>นักเรียน</span>
          <strong>
            {visible.length}
            <small> คน</small>
          </strong>
        </div>
        <div>
          <span>ชิ้นงาน</span>
          <strong>
            {tasks.length}
            <small> ชิ้น</small>
          </strong>
        </div>
        <div>
          <span>ส่งครบทุกชิ้น</span>
          <strong>
            {complete}
            <small> คน</small>
          </strong>
        </div>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          data-testid="show-inactive"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        แสดงนักเรียนที่ปิดใช้งาน
      </label>
      {!visible.length && (
        <div className="empty" data-testid="empty-students">
          <h3>ยังไม่มีนักเรียน</h3>
          <p>เพิ่มรายชื่อทีละคน หรือนำเข้าจาก Excel</p>
          <Button asChild variant="outline" data-testid="empty-add-student">
            <Link to="?tab=students">เพิ่มนักเรียน / นำเข้า Excel</Link>
          </Button>
        </div>
      )}
      {!tasks.length && (
        <div className="empty" data-testid="empty-tasks">
          <h3>ยังไม่มีชิ้นงาน</h3>
          <p>สร้างชิ้นงานก่อนเริ่มบันทึกการส่งงาน</p>
          <Button asChild data-testid="empty-add-task">
            <Link to="?tab=tasks&add=1">เพิ่มชิ้นงาน</Link>
          </Button>
        </div>
      )}
      {visible.length > 0 && tasks.length > 0 && (
        <>
          <p className="caption table-hint">
            แตะช่องเพื่อดูชื่อเต็มและแก้สถานะ · เลื่อนตารางได้ทั้งสองทิศทาง
          </p>
          <WorkTable
            students={visible}
            tasks={tasks}
            work={work}
            onSelect={(student, task) => {
              onSaved("");
              setSelection({ student, task });
            }}
          />
        </>
      )}
      {selection && (
        <WorkStatusForm
          key={`${selection.student.id}:${selection.task.id}`}
          classId={classroom.id}
          {...selection}
          onClose={() => setSelection(undefined)}
          onSaved={() => onSaved("บันทึกสถานะงานแล้ว")}
        />
      )}
    </>
  );
}
