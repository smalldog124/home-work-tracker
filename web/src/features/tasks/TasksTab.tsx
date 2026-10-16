import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ErrorState";
import { newRequestId } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { useAuth } from "../auth/useAuth";
import type { ClassRecord } from "../classes/api";
import type { WorkRecord } from "../summary/api";
import { deleteTask, type Task } from "./api";
import { TaskForm } from "./TaskForm";
export function TasksTab({
  classroom,
  tasks,
  work,
  onSaved,
}: {
  classroom: ClassRecord;
  tasks: Task[];
  work: WorkRecord[];
  onSaved: (text: string) => void;
}) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Task | "new" | null>(
    params.get("add") === "1" ? "new" : null,
  );
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  function closeForm() {
    setEditing(null);
    if (params.has("add")) setParams({ tab: "tasks" }, { replace: true });
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteTask({
        requestId: newRequestId(),
        classId: classroom.id,
        taskId: deleting.id,
        expectedVersion: deleting.version,
        confirmed: true,
      });
      await queryClient.invalidateQueries({
        queryKey: [user!.uid, "class", classroom.id],
      });
      onSaved("ลบชิ้นงานแล้ว");
      setDeleting(null);
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
          ชิ้นงาน <span className="count">{tasks.length} ชิ้น</span>
        </h2>
        <Button data-testid="add-task" onClick={() => setEditing("new")}>
          <Plus size={20} />
          เพิ่มชิ้นงาน
        </Button>
      </div>
      <p className="muted">
        เรียงตามลำดับที่สร้าง การสแกนปกติจะบันทึกลงชิ้นงานล่าสุดเสมอ
      </p>
      {tasks.length ? (
        <div className="task-list">
          {tasks.map((t) => {
            const sent = work.filter((w) => w.taskId === t.id).length;
            return (
              <div
                className="task-row"
                key={t.id}
                data-testid={`task-row-${t.id}`}
              >
                <span className="task-number">{t.order}</span>
                <div className="task-identity">
                  <strong>{t.name}</strong>
                  <span className="caption">
                    ส่งแล้ว {sent} คน
                    {classroom.latestTaskId === t.id ? " · ชิ้นงานล่าสุด" : ""}
                  </span>
                </div>
                <div className="row-actions">
                  <Button
                    variant="ghost"
                    data-testid={`edit-task-${t.id}`}
                    onClick={() => setEditing(t)}
                  >
                    เปลี่ยนชื่อ
                  </Button>
                  <Button
                    variant="ghost"
                    data-testid={`delete-task-${t.id}`}
                    disabled={sent > 0}
                    title={
                      sent ? "ลบได้เมื่อเปลี่ยนทุกคนเป็นยังไม่ส่ง" : "ลบชิ้นงาน"
                    }
                    onClick={() => {
                      setDeleting(t);
                      setError(undefined);
                    }}
                  >
                    ลบ
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <h3>ยังไม่มีชิ้นงาน</h3>
          <p>เพิ่มชิ้นงานก่อนเริ่มสแกน</p>
          <Button onClick={() => setEditing("new")}>เพิ่มชิ้นงาน</Button>
        </div>
      )}
      <p className="caption">
        ลบชิ้นงานได้เมื่อไม่มีรายการส่งงานปัจจุบันเหลืออยู่
      </p>
      {editing && (
        <TaskForm
          classId={classroom.id}
          tasks={tasks}
          task={editing === "new" ? undefined : editing}
          onClose={closeForm}
          onSaved={() => onSaved("บันทึกชิ้นงานแล้ว พร้อมสแกนงาน")}
        />
      )}
      {deleting && (
        <Panel
          title="ยืนยันการลบชิ้นงาน"
          testId="confirm-delete-task"
          onClose={() => setDeleting(null)}
          locked={busy}
        >
          <p>{deleting.name}</p>
          <p className="muted">
            ชิ้นงานจะถูกนำออกจากตาราง
            ประวัติการเปลี่ยนแปลงยังเก็บไว้จนกว่าข้อมูลปีการศึกษาจะหมดอายุ
          </p>
          {error !== undefined && <ErrorState error={error} />}
          <div className="actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "กำลังลบ…" : "ยืนยัน"}
            </Button>
          </div>
        </Panel>
      )}
    </>
  );
}
