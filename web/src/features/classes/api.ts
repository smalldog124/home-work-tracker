import { mutate } from "@/lib/save-request";
import { useQuery } from "@tanstack/react-query";
import { orderBy, where } from "firebase/firestore";
import { createClassSchema, deleteClassSchema } from "@home-work/shared";
import { call, list, record } from "@/lib/api";
import { useAuth } from "../auth/useAuth";
export interface ClassRecord {
  id: string;
  year: number;
  term: 1 | 2;
  subject: string;
  group: string;
  version: number;
  rosterVersion: number;
  latestTaskId: string | null;
}
export interface Retention {
  currentYear: number;
  retainedYears: number[];
  notice: { year: number; expiresAt: string; days: number } | null;
}
export const getRetention = () => call<Retention>("getRetention", {});
export const getClasses = (uid: string, year: number, term: number) =>
  list<ClassRecord>(uid, "classes", [
    where("year", "==", year),
    where("term", "==", term),
    where("status", "==", "active"),
  ]);
export const getClass = (uid: string, id: string) =>
  record<ClassRecord>(uid, `classes/${id}`);
export const getSubjects = (uid: string) =>
  list<{ id: string; name: string }>(uid, "subjects", [orderBy("name")]);
export const createClass = (input: unknown) =>
  mutate<{ classId: string }>("createClass", input, createClassSchema);
export function useRetention() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [user!.uid, "retention"],
    queryFn: getRetention,
  });
}
export function useClasses(year: number, term: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [user!.uid, "classes", year, term],
    queryFn: () => getClasses(user!.uid, year, term),
    enabled: year > 0,
  });
}

export const deleteClass = (input: unknown) => mutate<{ classId: string; status: "deleting" }>("deleteClass", input, deleteClassSchema);
