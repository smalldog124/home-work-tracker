import { qrDownloadSchema } from "@home-work/shared";
import { call } from "@/lib/api";
export interface QrData {
  classId: string;
  year: number;
  term: number;
  subject: string;
  group: string;
  cards: {
    studentId: string;
    number: number;
    name: string;
    payload: string;
    publicCode: string;
  }[];
}
export const getQrData = (classId: string, studentId?: string) =>
  call<QrData>(
    "getQrData",
    { classId, ...(studentId ? { studentId } : {}) },
    qrDownloadSchema,
  );
