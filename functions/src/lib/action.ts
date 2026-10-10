import { randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import type { z } from "zod";
import type { DecodedIdToken } from "firebase-admin/auth";
import { context } from "./firebase-admin";
import { authorize } from "./auth";
import { rateLimit } from "./rate-limit";
import { fail } from "./errors";
const emulator = process.env.FUNCTIONS_EMULATOR === "true";
const origins = (process.env.APP_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
export function action<S extends z.ZodType, R>(
  name: string,
  schema: S,
  run: (
    uid: string,
    input: z.output<S>,
    identity: DecodedIdToken,
  ) => Promise<R> | R,
) {
  return onCall(
    {
      region: "asia-southeast1",
      enforceAppCheck: !emulator,
      cors: emulator
        ? [/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/]
        : origins.length
          ? origins
          : false,
      minInstances: 0,
      maxInstances: 10,
      timeoutSeconds: 60,
      memory: "256MiB",
    },
    async (request) => {
      const started = Date.now();
      const correlationId = randomUUID();
      try {
        if (!emulator && !origins.length)
          fail(
            "failed-precondition",
            "ระบบยังไม่ได้ตั้งค่าโดเมน กรุณาติดต่อผู้ดูแล",
            "ORIGINS_UNCONFIGURED",
          );
        const origin = request.rawRequest.headers.origin;
        if (!emulator && origin && !origins.includes(origin))
          fail("permission-denied", "โดเมนนี้ไม่ได้รับอนุญาต", "ORIGIN_DENIED");
        if (
          Buffer.byteLength(JSON.stringify(request.data) ?? "", "utf8") >
          256 * 1024
        )
          fail("invalid-argument", "ข้อมูลคำขอใหญ่เกินไป", "REQUEST_TOO_LARGE");
        const identity = await authorize(request);
        const parsed = schema.safeParse(request.data);
        if (!parsed.success)
          fail(
            "invalid-argument",
            "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบช่องที่ระบุ",
            "INVALID_INPUT",
            {
              fields: parsed.error.issues.map((issue) => issue.path.join(".")),
            },
          );
        await rateLimit(context, identity.uid, name);
        const result = await run(identity.uid, parsed.data, identity);
        logger.info("action", {
          action: name,
          result: "ok",
          durationMs: Date.now() - started,
          correlationId,
        });
        return result;
      } catch (error) {
        const code = error instanceof HttpsError ? error.code : "internal";
        logger.warn("action", {
          action: name,
          result: code,
          durationMs: Date.now() - started,
          correlationId,
        });
        if (error instanceof HttpsError) throw error;
        throw new HttpsError(
          "internal",
          "บันทึกไม่สำเร็จ กรุณาตรวจสอบผลก่อนลองอีกครั้ง",
          { reason: "INTERNAL", correlationId },
        );
      }
    },
  );
}
