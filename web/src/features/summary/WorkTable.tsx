import { STATUS_LABELS } from "@home-work/shared";
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
  const sortedStudents = [...students].sort((a, b) => a.number - b.number);
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
            <th scope="col" className="corner">
              นักเรียน
            </th>
            <th scope="col" className="missing-count">
              ยังไม่ส่ง (ชิ้น)
            </th>
            {tasks.map((t) => (
              <th
                scope="col"
                key={t.id}
                data-testid="task-header"
                className="task-column"
              >
                <span className="task-name">{t.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedStudents.map((s) => {
            const missing = tasks.filter((t) => {
              const record = cells.get(`${s.id}:${t.id}`);
              return !record || record.status === "not-sent";
            }).length;
            return (
              <tr key={s.id}>
                <th scope="row" data-testid="student-header">
                  {s.name}
                  {!s.active && " (ปิด)"}
                </th>
                <td
                  className="missing-count"
                  data-testid={`missing-count-${s.id}`}
                >
                  {missing}
                </td>
                {tasks.map((t) => {
                  const status =
                    cells.get(`${s.id}:${t.id}`)?.status || "not-sent";
                  return (
                    <td key={t.id}>
                      <button
                        type="button"
                        className={`work-cell ${status}`}
                        data-testid={`work-cell-${s.id}-${t.id}`}
                        aria-label={`${s.name} ${t.name} ${STATUS_LABELS[status]}`}
                        onClick={() => onSelect(s, t)}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
