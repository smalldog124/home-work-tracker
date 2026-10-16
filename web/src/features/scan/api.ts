import {
  scanSchema,
  pastWorkSchema,
  resolveQrSchema,
  resultSchema,
} from "@home-work/shared";
import { call } from "@/lib/api";
import type { WorkResult, WorkStatus } from "../summary/api";
export interface ResolvedQr {
  student: { id: string; number: number; name: string };
  class: {
    id: string;
    year: number;
    term: number;
    subject: string;
    group: string;
  };
  tasks: {
    id: string;
    name: string;
    order: number;
    status: WorkStatus;
    savedAt: string | null;
    selectable: boolean;
  }[];
}
export const resolveQr = (payload: string) =>
  call<ResolvedQr>("resolveQr", { payload }, resolveQrSchema);
export const saveWork = (input: unknown) =>
  call<WorkResult>("saveWork", input, scanSchema);
export const savePastWork = (input: unknown) =>
  call<WorkResult>("savePastWork", input, pastWorkSchema);
export type RequestResult =
  | { state: "unknown" }
  | { state: "confirmed"; action: string; result: WorkResult };
export const getRequestResult = (requestId: string) =>
  call<RequestResult>("getRequestResult", { requestId }, resultSchema);
