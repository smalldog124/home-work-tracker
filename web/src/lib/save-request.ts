import type { ZodType } from "zod";
import { auth } from "./firebase";
import { AccountChangedError, call, reason, uncertain } from "./api";
interface Pending {
  action: string;
  input: Record<string, unknown> & { requestId: string };
}
const key = (uid: string) => `pending-edit:${uid}`;
function same(a: Pending, b: Pending) {
  const normalize = (request: Pending) =>
    JSON.stringify(
      Object.entries(request.input)
        .filter(([k]) => k !== "requestId")
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  return a.action === b.action && normalize(a) === normalize(b);
}
export function clearPendingEdit(uid: string) {
  try {
    localStorage.removeItem(key(uid));
  } catch {}
}
export async function mutate<T>(
  action: string,
  input: unknown,
  schema: ZodType,
): Promise<T> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
  let request: Pending = {
    action,
    input: schema.parse(input) as Pending["input"],
  };
  let previous: Pending | undefined;
  try {
    const stored = localStorage.getItem(key(uid));
    if (stored) previous = JSON.parse(stored);
  } catch {
    throw new Error(
      "ไม่สามารถอ่านคำขอบันทึกที่ค้างอยู่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์",
    );
  }
  if (previous) {
    let result:
      { state: "unknown" } | { state: "confirmed"; action: string; result: T };
    try {
      result = await call("getRequestResult", {
        requestId: previous.input.requestId,
      });
    } catch (error) {
      if (
        !(error instanceof AccountChangedError) &&
        reason(error) === "YEAR_UNAVAILABLE"
      )
        clearPendingEdit(uid);
      throw error;
    }
    if (result.state === "confirmed") {
      clearPendingEdit(uid);
      if (same(previous, request) && result.action === action)
        return result.result;
    } else {
      if (!same(previous, request))
        throw new Error(
          "ยังไม่ทราบผลรายการก่อนหน้า กรุณาลองบันทึกข้อมูลเดิมเพื่อตรวจสอบผลก่อนทำรายการใหม่",
        );
      request = previous;
    }
  }
  try {
    localStorage.setItem(key(uid), JSON.stringify(request));
  } catch {
    throw new Error(
      "ไม่สามารถเก็บคำขอบันทึกได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์",
    );
  }
  try {
    const result = await call<T>(action, request.input, schema);
    clearPendingEdit(uid);
    return result;
  } catch (error) {
    if (error instanceof AccountChangedError) throw error;
    if (!uncertain(error)) clearPendingEdit(uid);
    if (uncertain(error))
      throw new Error(
        "ยังไม่ทราบผลการบันทึก กรุณาเชื่อมต่ออินเทอร์เน็ต แล้วลองบันทึกข้อมูลเดิมเพื่อตรวจสอบผล",
      );
    throw error;
  }
}
