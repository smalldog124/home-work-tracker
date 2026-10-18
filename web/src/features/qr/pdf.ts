import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import sarabunUrl from "@/assets/fonts/Sarabun-Regular.ttf?url";
import type { QrData } from "./api";
export const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 16,
  columns: 4,
  rows: 5,
};
function wrap(
  value: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const segments = new Intl.Segmenter("th", {
    granularity: "grapheme",
  }).segment(value);
  const lines: string[] = [];
  let line = "";
  for (const { segment } of segments) {
    if (line && font.widthOfTextAtSize(line + segment, size) > width) {
      lines.push(line);
      line = "";
    }
    line += segment;
  }
  if (line) lines.push(line);
  return lines;
}
export async function makeQrPdf(data: QrData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const response = await fetch(sarabunUrl);
  if (!response.ok) throw new Error("โหลดฟอนต์สำหรับเอกสารไม่ได้");
  const font = await pdf.embedFont(await response.arrayBuffer(), {
    subset: true,
  });
  pdf.setTitle(`QR ${data.subject} ${data.group} ${data.year}/${data.term}`);
  const width = (PAGE.width - PAGE.margin * 2) / PAGE.columns;
  const height = (PAGE.height - PAGE.margin * 2) / PAGE.rows;
  const cards = [...data.cards].sort((a, b) => a.number - b.number);
  for (let index = 0; index < cards.length; index++) {
    const page =
      index % 20 === 0
        ? pdf.addPage([PAGE.width, PAGE.height])
        : pdf.getPages().at(-1)!;
    const card = cards[index];
    const column = index % 4;
    const row = Math.floor((index % 20) / 4);
    const x = PAGE.margin + column * width;
    const top = PAGE.height - PAGE.margin - row * height;
    const bottom = top - height;
    page.drawRectangle({
      x,
      y: bottom,
      width,
      height,
      borderColor: rgb(0.65, 0.65, 0.65),
      borderWidth: 0.3,
    });
    function centered(value: string, y: number, size = 8) {
      let fit = size;
      while (font.widthOfTextAtSize(value, fit) > width - 12 && fit > 4)
        fit -= 0.25;
      page.drawText(value, {
        x: x + (width - font.widthOfTextAtSize(value, fit)) / 2,
        y,
        size: fit,
        font,
      });
    }
    centered(`เลขที่ ${card.number}`, top - 13, 10);
    let nameSize = 8.5;
    let lines = wrap(card.name, font, nameSize, width - 12);
    while (lines.length > 4 && nameSize > 4) {
      nameSize -= 0.25;
      lines = wrap(card.name, font, nameSize, width - 12);
    }
    lines.forEach((line, i) =>
      centered(line, top - 25 - i * (nameSize + 1), nameSize),
    );
    const image = await pdf.embedPng(
      await QRCode.toDataURL(card.payload, {
        width: 640,
        margin: 4,
        errorCorrectionLevel: "M",
      }),
    );
    const qrSize = Math.min(94, height - 56 - lines.length * (nameSize + 1));
    page.drawImage(image, {
      x: x + (width - qrSize) / 2,
      y: bottom + 28,
      width: qrSize,
      height: qrSize,
    });
    centered(data.subject, bottom + 20);
    centered(`กลุ่ม ${data.group}`, bottom + 11);
    centered(`ปี ${data.year} · ภาคเรียน ${data.term}`, bottom + 3, 7);
  }
  return pdf.save();
}
export async function makeQrPng(payload: string): Promise<Uint8Array> {
  const data = await QRCode.toDataURL(payload, {
    width: 1024,
    margin: 4,
    errorCorrectionLevel: "M",
  });
  const base64 = data.slice(data.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}
