import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { message } from "@/lib/api";
import { getQrData } from "./api";
import { download } from "./download";
export function QrDownload({
  classId,
  studentId,
  disabled,
  testId,
  label,
}: {
  classId: string;
  studentId?: string;
  disabled?: boolean;
  testId?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setBusy(true);
    setError("");
    try {
      const data = await getQrData(classId, studentId);
      if (!data.cards.length) throw new Error("ยังไม่มีนักเรียนที่เปิดใช้งาน");
      const { makeQrPdf, makeQrPng } = await import("./pdf");
      if (studentId)
        download(
          await makeQrPng(data.cards[0].payload),
          `QR-เลขที่-${data.cards[0].number}.png`,
          "image/png",
        );
      else
        download(
          await makeQrPdf(data),
          `QR-${data.subject}-${data.group}-${data.year}-${data.term}.pdf`,
          "application/pdf",
        );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="qr-download">
      <Button
        variant="outline"
        data-testid={
          testId ||
          (studentId ? `download-student-qr-${studentId}` : "download-class-qr")
        }
        disabled={busy || disabled}
        onClick={() => void run()}
      >
        <Download size={17} />
        {busy
          ? "กำลังสร้าง…"
          : label || (studentId ? "QR" : "ดาวน์โหลด QR ทั้งห้อง")}
      </Button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
