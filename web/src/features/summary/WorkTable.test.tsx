// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { afterEach, expect, it, vi } from "vitest";
import { WORK_STATUSES, STATUS_LABELS } from "@home-work/shared";
import type { Student } from "../students/api";
import type { Task } from "../tasks/api";
import type { WorkRecord } from "./api";
import { WorkTable } from "./WorkTable";

afterEach(cleanup);
const students: Student[] = [
  {
    id: "b",
    number: 10,
    name: "สมหญิง ทดสอบ",
    active: false,
    version: 1,
    publicCode: "b",
  },
  {
    id: "a",
    number: 2,
    name: "สมชาย ทดสอบ",
    active: true,
    version: 1,
    publicCode: "a",
  },
];
const tasks: Task[] = WORK_STATUSES.map((_, i) => ({
  id: `task-${i}`,
  name: `ชิ้นงานที่ ${i + 1}`,
  order: i + 1,
  version: 1,
}));
const work: WorkRecord[] = WORK_STATUSES.map((status, i) => ({
  id: `work-${i}`,
  studentId: "a",
  taskId: tasks[i].id,
  status,
  savedAt: Timestamp.fromMillis(0),
  version: 1,
}));

it("renders students as rows sorted numerically without numbers or mutating input", () => {
  render(
    <WorkTable
      students={students}
      tasks={tasks}
      work={work}
      onSelect={vi.fn()}
    />,
  );
  const rows = screen.getAllByRole("row").slice(1);
  expect(within(rows[0]).getByTestId("student-header").textContent).toBe(
    "สมชาย ทดสอบ",
  );
  expect(within(rows[1]).getByTestId("student-header").textContent).toBe(
    "สมหญิง ทดสอบ (ปิด)",
  );
  expect(screen.queryByText(/เลขที่/)).toBeNull();
  expect(students.map((s) => s.id)).toEqual(["b", "a"]);
  expect(
    within(screen.getAllByRole("row")[0])
      .getAllByTestId("task-header")
      .map((el) => el.textContent),
  ).toEqual(tasks.map((t) => t.name));
});

it("counts missing and not-sent work, treating every late status as submitted", () => {
  const unrelated: WorkRecord = {
    ...work[1],
    id: "other",
    taskId: "deleted-task",
    studentId: "b",
  };
  const { rerender } = render(
    <WorkTable
      students={students}
      tasks={tasks}
      work={[...work, unrelated]}
      onSelect={vi.fn()}
    />,
  );
  expect(screen.getByTestId("missing-count-a").textContent).toBe("1");
  expect(screen.getByTestId("missing-count-b").textContent).toBe("6");
  rerender(
    <WorkTable
      students={students}
      tasks={tasks}
      work={[...work, { ...work[1], taskId: tasks[0].id }]}
      onSelect={vi.fn()}
    />,
  );
  expect(screen.getByTestId("missing-count-a").textContent).toBe("0");
  rerender(
    <WorkTable students={students} tasks={[]} work={work} onSelect={vi.fn()} />,
  );
  expect(screen.getByTestId("missing-count-a").textContent).toBe("0");
});

it("renders color-only status buttons with accessible labels and selects the correct pair", () => {
  const onSelect = vi.fn();
  render(
    <WorkTable
      students={students}
      tasks={tasks}
      work={work}
      onSelect={onSelect}
    />,
  );
  WORK_STATUSES.forEach((status, i) => {
    const cell = screen.getByTestId(`work-cell-a-${tasks[i].id}`);
    expect(cell.textContent).toBe("");
    expect(cell.classList.contains(status)).toBe(true);
    expect(cell.getAttribute("aria-label")).toBe(
      `สมชาย ทดสอบ ${tasks[i].name} ${STATUS_LABELS[status]}`,
    );
  });
  const missing = screen.getByTestId(`work-cell-b-${tasks[0].id}`);
  expect(missing.textContent).toBe("");
  expect(missing.classList.contains("not-sent")).toBe(true);
  expect(missing.getAttribute("aria-label")).toContain("ยังไม่ส่ง");
  fireEvent.click(screen.getByTestId(`work-cell-a-${tasks[2].id}`));
  expect(onSelect).toHaveBeenCalledWith(students[1], tasks[2]);
});
