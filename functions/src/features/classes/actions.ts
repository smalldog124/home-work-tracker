import { z } from 'zod';
import { createClassSchema, deleteClassSchema } from '@home-work/shared';
import { action } from '../../lib/action';
import { context } from '../../lib/firebase-admin';
import { createClass, getRetention } from './service';
import { deleteClass } from './deletion';
export const deleteClassAction = action('deleteClass', deleteClassSchema, (uid, input) => deleteClass(context, uid, input));
export const createClassAction = action('createClass', createClassSchema, (uid, input) => createClass(context, uid, input));
export const getRetentionAction = action('getRetention', z.object({}).strict(), () => getRetention(context));
