import { studentNumber, text } from "@home-work/shared";
import type { Student } from "./api";
export interface ReviewRow {
  id: number;
  number: string;
  name: string;
}
export type RowKind = "new" | "changed" | "unchanged" | "invalid";
export function reviewRows(rows: ReviewRow[], students: Student[]) {
  const counts = new Map<number, number>();
  rows.forEach((r) => {
    const n = studentNumber.safeParse(r.number);
    if (n.success) counts.set(n.data, (counts.get(n.data) || 0) + 1);
  });
  return rows.map((row) => {
    const n = studentNumber.safeParse(row.number);
    const name = text.safeParse(row.name);
    const errors: string[] = [];
    if (!n.success) errors.push("เลขที่: ต้องเป็นจำนวนเต็มบวกไม่เกิน 999999");
    else if (counts.get(n.data)! > 1) errors.push("เลขที่: ซ้ำในไฟล์");
    if (!name.success)
      errors.push("ชื่อ-นามสกุล: กรอกข้อความธรรมดา 1–200 ตัวอักษร");
    const old = n.success
      ? students.find((s) => s.number === n.data)
      : undefined;
    const kind: RowKind = errors.length
      ? "invalid"
      : !old
        ? "new"
        : old.name === name.data
          ? "unchanged"
          : "changed";
    return { ...row, kind, errors };
  });
}
export async function readExcel(file: File): Promise<ReviewRow[]> {
  if (!/\.xlsx$/i.test(file.name))
    throw new Error("เลือกไฟล์ Excel ชนิด .xlsx");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error("อ่านไฟล์ไม่ได้ กรุณาใช้ไฟล์ตัวอย่างแล้วลองอีกครั้ง");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2)
    throw new Error("ไม่พบรายชื่อนักเรียนในไฟล์");
  if (sheet.rowCount - 1 > 200)
    throw new Error("นำเข้าได้ไม่เกิน 200 แถวต่อครั้ง");
  if (
    sheet.getCell("A1").text.trim() !== "เลขที่" ||
    sheet.getCell("B1").text.trim() !== "ชื่อ-นามสกุล"
  )
    throw new Error("ใช้หัวคอลัมน์ เลขที่ และ ชื่อ-นามสกุล ตามไฟล์ตัวอย่าง");
  const rows: ReviewRow[] = [];
  for (let index = 2; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index);
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.type === ExcelJS.ValueType.Formula || cell.formula)
        throw new Error(`แถว ${index}: ไม่อนุญาตให้ใช้สูตรในไฟล์ Excel`);
    });
    const value = (col: number) => {
      const cell = row.getCell(col);
      if (
        cell.type === ExcelJS.ValueType.Hyperlink ||
        cell.type === ExcelJS.ValueType.Error ||
        cell.type === ExcelJS.ValueType.Date
      )
        throw new Error(`แถว ${index}: ใช้เฉพาะเลขที่และข้อความชื่อ`);
      return cell.text;
    };
    rows.push({ id: index - 2, number: value(1), name: value(2) });
  }
  return rows;
}
export async function excelTemplate(): Promise<Uint8Array> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("รายชื่อนักเรียน");
  sheet.columns = [
    { header: "เลขที่", key: "number", width: 12 },
    { header: "ชื่อ-นามสกุล", key: "name", width: 40 },
  ];
  sheet.addRow({ number: 1, name: "นักเรียน ตัวอย่าง" });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
