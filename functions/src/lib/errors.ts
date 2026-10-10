import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';
export function fail(code: FunctionsErrorCode, message: string, reason: string, details: Record<string, unknown> = {}): never {
  throw new HttpsError(code, message, { reason, ...details });
}
export function checkVersion(actual: number, expected: number) {
  if (actual !== expected) fail('aborted', 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่และตรวจสอบก่อนบันทึก', 'VERSION_CONFLICT');
}
