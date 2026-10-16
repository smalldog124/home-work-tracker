import { STATUS_LABELS } from "@home-work/shared";
import { thaiDate } from "@/lib/date";
import type { Student } from "../students/api";
import type { Task } from "../tasks/api";
import type { WorkRecord } from "./api";
export function WorkTable({
  students,
  tasks,
  work,
  onSelect,
}: {
  students: Student[];
  tasks: Task[];
  work: WorkRecord[];
  onSelect: (student: Student, task: Task) => void;
}) {
  const cells = new Map(work.map((w) => [`${w.studentId}:${w.taskId}`, w]));
  return (
    <div
      className="summary-scroll"
      data-testid="summary-scroll"
      tabIndex={0}
      role="region"
      aria-label="ตารางการส่งงาน เลื่อนได้ทั้งแนวนอนและแนวตั้ง"
    >
      <table className="work-table" data-testid="summary-table">
        <thead>
          <tr>
            <th className="corner">ชิ้นงาน / นักเรียน</th>
            {students.map((s) => (
              <th key={s.id} data-testid="student-header">
                <span>
                  เลขที่ {s.number}
                  {!s.active && " (ปิด)"}
                </span>
                <span title={s.name} className="short-name">
                  {s.name.split(" ")[0]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <th data-testid="task-header">{t.name}</th>
              {students.map((s) => {
                const w = cells.get(`${s.id}:${t.id}`);
                return (
                  <td key={s.id}>
                    <button
                      className={`work-cell ${w?.status || "not-sent"}`}
                      data-testid={`work-cell-${s.id}-${t.id}`}
                      aria-label={`${s.name} ${t.name} ${w ? STATUS_LABELS[w.status] : "ยังไม่ส่ง"}`}
                      onClick={() => onSelect(s, t)}
                    >
                      {w ? (
                        <>
                          <span>
                            {thaiDate(w.savedAt.toDate().toISOString())}
                          </span>
                          <span>{STATUS_LABELS[w.status]}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
