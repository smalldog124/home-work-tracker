import { mutate } from "@/lib/save-request";
import { orderBy } from "firebase/firestore";
import {
  addStudentSchema,
  updateStudentSchema,
  toggleStudentSchema,
  importStudentsSchema,
} from "@home-work/shared";
import { call, list } from "@/lib/api";
export interface Student {
  id: string;
  number: number;
  name: string;
  active: boolean;
  version: number;
  publicCode: string;
}
export const getStudents = (uid: string, classId: string) =>
  list<Student>(uid, `classes/${classId}/students`, [orderBy("number")]);
export const addStudent = (input: unknown) =>
  mutate<Student>("addStudent", input, addStudentSchema);
export const updateStudent = (input: unknown) =>
  mutate<Student & { qrReplaced: boolean }>(
    "updateStudent",
    input,
    updateStudentSchema,
  );
export const toggleStudent = (input: unknown) =>
  mutate<Student>("setStudentActive", input, toggleStudentSchema);
export const importStudents = (input: unknown) =>
  mutate<{ added: number; changed: number; unchanged: number }>(
    "importStudents",
    input,
    importStudentsSchema,
  );
