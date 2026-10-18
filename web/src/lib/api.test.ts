import { expect, it, vi } from "vitest";

vi.mock("./firebase", () => ({ auth: {}, db: {}, functions: {} }));

import { message } from "./api";

it("explains blocked sign-in popups instead of reporting an internet problem", () => {
  const text = message({ code: "auth/popup-blocked" });
  expect(text).toContain("อนุญาต popup");
  expect(text).toContain("auth/popup-blocked");
  expect(text).not.toContain("ตรวจสอบอินเทอร์เน็ต");
});

it("preserves unrecognized auth error codes without exposing raw error details", () => {
  const error = Object.assign(new Error("Sensitive provider response"), {
    code: "auth/internal-error",
  });
  expect(message(error)).toContain("auth/internal-error");
  expect(message(error)).not.toContain("Sensitive provider response");
});

it("keeps existing domain conflict messages", () => {
  expect(message({ details: { reason: "VERSION_CONFLICT" } })).toBe(
    "ข้อมูลเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดและตรวจสอบก่อนบันทึก",
  );
});
