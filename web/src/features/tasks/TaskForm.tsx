import { useState } from "react";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ErrorState";
import { newRequestId } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { useAuth } from "../auth/useAuth";
import { createTask, renameTask, type Task } from "./api";
export function TaskForm({
  classId,
  tasks,
  task,
  onClose,
  onSaved,
}: {
  classId: string;
  tasks: Task[];
  task?: Task;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(
    task?.name || `ชิ้นงานที่ ${Math.max(0, ...tasks.map((t) => t.order)) + 1}`,
  );
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      const input = { requestId: newRequestId(), classId, name };
      if (task)
        await renameTask({
          ...input,
          taskId: task.id,
          expectedVersion: task.version,
        });
      else await createTask(input);
      await queryClient.invalidateQueries({
        queryKey: [user!.uid, "class", classId],
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title={task ? "เปลี่ยนชื่อชิ้นงาน" : "เพิ่มชิ้นงาน"}
      onClose={onClose}
      locked={busy}
    >
      <form onSubmit={save}>
        <label>
          ชื่อชิ้นงาน
          <input
            autoFocus
            required
            maxLength={200}
            data-testid="task-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {!task && (
          <p className="notice">
            การสแกนปกติของห้องนี้จะบันทึกลงชิ้นงานใหม่
            ชิ้นงานเก่าที่ยังไม่ส่งสามารถบันทึกผ่านโหมดงานย้อนหลัง
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
            variant="outline"
            type="button"
            data-testid="cancel-task"
            onClick={onClose}
            disabled={busy}
          >
            ยกเลิก
          </Button>
          <Button data-testid="save-task" disabled={busy}>
            {busy ? "กำลังบันทึก…" : "เพิ่ม"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
