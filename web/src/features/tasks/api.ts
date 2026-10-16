import { mutate } from "@/lib/save-request";
import { orderBy } from "firebase/firestore";
import {
  createTaskSchema,
  renameTaskSchema,
  deleteTaskSchema,
} from "@home-work/shared";
import { call, list } from "@/lib/api";
export interface Task {
  id: string;
  name: string;
  order: number;
  version: number;
}
export const getTasks = (uid: string, classId: string) =>
  list<Task>(uid, `classes/${classId}/tasks`, [orderBy("order")]);
export const createTask = (input: unknown) =>
  mutate<Task>("createTask", input, createTaskSchema);
export const renameTask = (input: unknown) =>
  mutate<Task>("renameTask", input, renameTaskSchema);
export const deleteTask = (input: unknown) =>
  mutate("deleteTask", input, deleteTaskSchema);
