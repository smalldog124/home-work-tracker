import { expect, it } from "vitest";
import { QrGate } from "./qr-gate";
it("holds one QR across blur and save pauses, then permits it after removal", () => {
  const gate = new QrGate();
  expect(gate.frame("a", 0)).toBe(true);
  expect(gate.frame("a", 200)).toBe(false);
  gate.frame(null, 300);
  expect(gate.frame("a", 400)).toBe(false);
  gate.frame(null, 500);
  gate.frame(null, 750);
  gate.frame(null, 1000);
  expect(gate.frame("a", 1100)).toBe(true);
  expect(gate.frame("b", 1200)).toBe(true);
});
