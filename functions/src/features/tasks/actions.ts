import { createTaskSchema, renameTaskSchema, deleteTaskSchema } from '@home-work/shared';
import { action } from '../../lib/action';
import { context } from '../../lib/firebase-admin';
import { createTask, renameTask, deleteTask } from './service';
export const createTaskAction = action('createTask', createTaskSchema, (uid, input) => createTask(context, uid, input));
export const renameTaskAction = action('renameTask', renameTaskSchema, (uid, input) => renameTask(context, uid, input));
export const deleteTaskAction = action('deleteTask', deleteTaskSchema, (uid, input) => deleteTask(context, uid, input));
