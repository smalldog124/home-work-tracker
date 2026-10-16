import { mutate } from "@/lib/save-request";
import {
  changeWorkSchema,
  getWorkSchema,
  type WORK_STATUSES,
} from "@home-work/shared";
import type { Timestamp } from "firebase/firestore";
import { call, list } from "@/lib/api";
export type WorkStatus = (typeof WORK_STATUSES)[number];
export interface WorkResult {
  status: WorkStatus;
  savedAt: string | null;
  version: number;
}
export interface WorkRecord {
  id: string;
  studentId: string;
  taskId: string;
  status: WorkStatus;
  savedAt: Timestamp;
  version: number;
}
export const getWorkList = (uid: string, classId: string) =>
  list<WorkRecord>(uid, `classes/${classId}/work`);
export const getWork = (input: unknown) =>
  call<WorkResult>("getWork", input, getWorkSchema);
export const changeWorkStatus = (input: unknown) =>
  mutate<WorkResult>("changeWorkStatus", input, changeWorkSchema);
