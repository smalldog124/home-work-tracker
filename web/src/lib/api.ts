import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  type QueryConstraint,
} from "firebase/firestore";
import type { ZodType } from "zod";
import { auth, db, functions } from "./firebase";

export class AccountChangedError extends Error {}
export async function call<T>(
  name: string,
  input: unknown,
  schema?: ZodType,
): Promise<T> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
  const data = schema ? schema.parse(input) : input;
  const result = await httpsCallable<unknown, T>(functions, name)(data);
  if (auth.currentUser?.uid !== uid) throw new AccountChangedError();
  return result.data;
}
export async function list<T>(
  uid: string,
  path: string,
  constraints: QueryConstraint[] = [],
): Promise<T[]> {
  const result = await getDocsFromServer(
    query(collection(db, `teachers/${uid}/${path}`), ...constraints),
  );
  if (auth.currentUser?.uid !== uid) throw new AccountChangedError();
  return result.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
}
export async function record<T>(uid: string, path: string): Promise<T> {
  const result = await getDocFromServer(doc(db, `teachers/${uid}/${path}`));
  if (auth.currentUser?.uid !== uid) throw new AccountChangedError();
  if (!result.exists()) throw new Error("ไม่สามารถเข้าถึงห้องเรียนนี้");
  return { ...result.data(), id: result.id } as T;
}
export function reason(error: unknown): string | undefined {
  return (error as { details?: { reason?: string } } | null)?.details?.reason;
}
export function message(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "permission-denied")
    return "ไม่สามารถเข้าถึงข้อมูลนี้ หรือข้อมูลปีการศึกษาหมดอายุแล้ว";
  if (reason(error) === "ALREADY_SENT")
    return "ไม่ได้บันทึก เพราะส่งแล้วสำหรับชิ้นงานนี้";
  if (reason(error) === "VERSION_CONFLICT")
    return "ข้อมูลเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดและตรวจสอบก่อนบันทึก";
  if (error instanceof Error && /[ก-๙]/u.test(error.message))
    return error.message.replace(/\s*\[\d{3}\]$/, "");
  return "ไม่สามารถทำรายการได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง";
}
export function uncertain(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return (
    !navigator.onLine ||
    !code ||
    [
      "functions/unavailable",
      "functions/deadline-exceeded",
      "functions/internal",
      "functions/unknown",
      "functions/cancelled",
    ].includes(code)
  );
}
export const newRequestId = () => crypto.randomUUID();
