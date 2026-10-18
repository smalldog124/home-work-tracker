import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { PDFDocument, PDFDict, PDFName } from "pdf-lib";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { makeQrPdf, makeQrPng } from "./pdf";
it("paginates A4 at 20 cards and embeds Sarabun with Thai shaping", async () => {
  const font = new Uint8Array(
    await readFile(
      new URL("../../assets/fonts/Sarabun-Regular.ttf", import.meta.url),
    ),
  );
  vi.stubGlobal("fetch", async () => new Response(font));
  try {
    const pdf = await PDFDocument.load(
      await makeQrPdf({
        classId: "c",
        year: 2569,
        term: 1,
        subject: "คณิตศาสตร์",
        group: "ม.1/1",
        cards: Array.from({ length: 21 }, (_, i) => ({
          studentId: `s${i}`,
          number: i + 1,
          name: "นักเรียน กิ่งแก้ว",
          payload: `hw1.${i}.${"a".repeat(64)}`,
          publicCode: "",
        })),
      }),
    );
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPages().map((p) => [p.getWidth(), p.getHeight()])).toEqual([
      [595.28, 841.89],
      [595.28, 841.89],
    ]);
    expect(
      pdf.context
        .enumerateIndirectObjects()
        .some(
          ([, object]) =>
            object instanceof PDFDict && object.has(PDFName.of("FontFile2")),
        ),
    ).toBe(true);
  } finally {
    vi.unstubAllGlobals();
  }
}, 20000);
it("produces a decodable individual QR without fetching a data URL blocked by CSP", async () => {
  const fetchBlockedByCsp = vi.fn(() => {
    throw new TypeError("Refused to connect because it violates connect-src");
  });
  vi.stubGlobal("fetch", fetchBlockedByCsp);
  try {
    const payload = `hw1.eyJ0ZXN0Ijp0cnVlfQ.${"b".repeat(64)}`;
    const png = PNG.sync.read(Buffer.from(await makeQrPng(payload)));
    expect(
      jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
    ).toBe(payload);
    expect(fetchBlockedByCsp).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
