// Dedicated Emulator bundle. Never imported by the production Functions entry.
import { readFileSync } from "node:fs";
import { context } from "../../../functions/src/lib/firebase-admin";
if (
  process.env.GCLOUD_PROJECT !== "demo-home-work" ||
  !process.env.E2E_CLOCK_FILE
)
  throw new Error("E2E Functions require the dedicated demo project");
context.now = () =>
  new Date(readFileSync(process.env.E2E_CLOCK_FILE!, "utf8").trim());
export * from "../../../functions/src/index";
