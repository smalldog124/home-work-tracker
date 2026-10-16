import { scanSchema, pastWorkSchema } from "@home-work/shared";
import { z } from "zod";
const pendingSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("saveWork"), input: scanSchema }).strict(),
  z
    .object({ action: z.literal("savePastWork"), input: pastWorkSchema })
    .strict(),
]);
export type PendingRequest = z.infer<typeof pendingSchema>;
const key = (uid: string) => `pending-scan:${uid}`;
export function readPending(uid: string): PendingRequest | null {
  try {
    const raw = localStorage.getItem(key(uid));
    if (!raw) return null;
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export function persistPending(uid: string, request: PendingRequest) {
  try {
    localStorage.setItem(
      key(uid),
      JSON.stringify(pendingSchema.parse(request)),
    );
  } catch {
    throw new Error(
      "อุปกรณ์ไม่สามารถเก็บคำขอบันทึกได้ กรุณาเปิดพื้นที่จัดเก็บของเบราว์เซอร์ก่อนสแกน",
    );
  }
}
export function clearPending(uid: string) {
  try {
    localStorage.removeItem(key(uid));
  } catch {
    /* Account isolation is also enforced by the storage key. */
  }
}
