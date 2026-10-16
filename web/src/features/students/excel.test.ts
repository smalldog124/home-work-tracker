import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readExcel, reviewRows } from "./excel";
import type { Student } from "./api";
const students: Student[] = [
  {
    id: "one",
    number: 1,
    name: "ชื่อ เดิม",
    active: false,
    version: 1,
    publicCode: "",
  },
];
async function file(rows: ExcelJS.CellValue[][]) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("นักเรียน");
  sheet.addRow(["เลขที่", "ชื่อ-นามสกุล"]);
  rows.forEach((r) => sheet.addRow(r));
  const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
  return new File([bytes], "students.xlsx");
}
describe("Excel review", () => {
  it("normalizes duplicate numbers and includes inactive students when matching", () => {
    const result = reviewRows(
      [
        { id: 0, number: "01", name: "ชื่อ ใหม่" },
        { id: 1, number: "1", name: "ชื่อ เดิม" },
        { id: 2, number: "", name: "" },
      ],
      students,
    );
    expect(result.map((r) => r.kind)).toEqual([
      "invalid",
      "invalid",
      "invalid",
    ]);
    expect(result[0].errors).toContain("เลขที่: ซ้ำในไฟล์");
    expect(
      reviewRows([{ id: 0, number: "01", name: "ชื่อ ใหม่" }], students)[0]
        .kind,
    ).toBe("changed");
    expect(
      reviewRows([{ id: 0, number: "1", name: "ชื่อ เดิม" }], students)[0].kind,
    ).toBe("unchanged");
  });
  it("preserves a blank row for correction and rejects formulas and oversized imports", async () => {
    expect(
      await readExcel(
        await file([
          [1, "ชื่อ ใหม่"],
          ["", ""],
        ]),
      ),
    ).toHaveLength(2);
    await expect(
      readExcel(await file([[{ formula: "1+1" }, "ชื่อ"]])),
    ).rejects.toThrow("สูตร");
    await expect(
      readExcel(
        await file(Array.from({ length: 201 }, (_, i) => [i + 1, "ชื่อ"])),
      ),
    ).rejects.toThrow("200");
  });
  it("rejects active content and malformed header before saving anything", async () => {
    expect(
      reviewRows(
        [{ id: 0, number: "2", name: "<script>ชื่อ</script>" }],
        students,
      )[0].kind,
    ).toBe("invalid");
    const bad = new File([new Uint8Array([1, 2, 3])], "broken.xlsx");
    await expect(readExcel(bad)).rejects.toThrow("อ่านไฟล์ไม่ได้");
  });
});
