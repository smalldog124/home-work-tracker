// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TeacherMenu } from "./TeacherMenu";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  refetch: vi.fn(),
  usePlan: vi.fn(),
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({
  user: { displayName: "ครูทดสอบ", email: "teacher@example.com" }, logout: mocks.logout,
}) }));
vi.mock("../plans/api", () => ({ usePlan: mocks.usePlan }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.usePlan.mockReturnValue({ data: { planId: "level1", expiresAt: "2027-11-10T18:30:00.000Z" } });
});
function setup() {
  return render(<MemoryRouter><Routes>
    <Route path="/" element={<TeacherMenu />} />
    <Route path="/plan/code" element={<h1>กรอกโค้ดเปลี่ยนแพ็กเกจ</h1>} />
  </Routes></MemoryRouter>);
}
function openMenu() { fireEvent.click(screen.getByRole("button", { name: "ครู" })); }

it("shows the signed-in teacher and paid expiry in Thailand time, then navigates to code entry", () => {
  setup(); openMenu();
  expect(screen.getByText("ครูทดสอบ")).toBeTruthy();
  expect(screen.getByText("teacher@example.com")).toBeTruthy();
  expect(screen.getByTestId("teacher-plan-summary").textContent).toContain("Level 1");
  expect(screen.getByTestId("teacher-plan-summary").textContent).toMatch(/11\/11\/(2570|70|2027)/);
  fireEvent.click(screen.getByRole("link", { name: "กรอกโค้ด" }));
  expect(screen.getByRole("heading").textContent).toBe("กรอกโค้ดเปลี่ยนแพ็กเกจ");
});

it("closes on Escape and outside press and returns keyboard focus to the teacher button", () => {
  setup(); openMenu();
  fireEvent.keyDown(screen.getByRole("link", { name: "กรอกโค้ด" }), { key: "Escape" });
  expect(screen.queryByRole("region", { name: "ข้อมูลครู" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "ครู" }));
  openMenu(); fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("region", { name: "ข้อมูลครู" })).toBeNull();
});

it("keeps code entry, contact and logout usable while the plan loads or fails", () => {
  mocks.usePlan.mockReturnValue({ isError: false });
  const view = setup(); openMenu();
  expect(screen.getByRole("status").textContent).toContain("กำลังโหลด");
  mocks.usePlan.mockReturnValue({ isError: true, isFetching: false, refetch: mocks.refetch });
  view.rerender(<MemoryRouter><TeacherMenu /></MemoryRouter>);
  openMenu();
  expect(screen.getByRole("alert").textContent).toContain("โหลดแพ็กเกจไม่สำเร็จ");
  expect(screen.getByRole("link", { name: "กรอกโค้ด" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "ติดต่อผู้ดูแล" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
  expect(mocks.refetch).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "ออกจากระบบ" }));
  expect(mocks.logout).toHaveBeenCalledOnce();
});

it("opens shared contact details and restores focus when the panel closes", async () => {
  setup(); openMenu();
  fireEvent.click(screen.getByRole("button", { name: "ติดต่อผู้ดูแล" }));
  expect(screen.getByRole("dialog").textContent).toContain("smalldoc124");
  expect(screen.getByRole("link", { name: "088-3564267" }).getAttribute("href")).toBe("tel:0883564267");
  fireEvent.click(screen.getByRole("button", { name: "ปิด" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "ครู" })));
});
