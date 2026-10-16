import { expect, it } from "vitest";
import { thaiDate } from "./date";
it("displays Buddhist dates across Bangkok midnight independently of local timezone", () => {
  expect(thaiDate("2026-10-10T16:59:59Z")).toBe("10/10/69");
  expect(thaiDate("2026-10-10T17:00:00Z")).toBe("11/10/69");
  expect(thaiDate(null)).toBe("—");
});
