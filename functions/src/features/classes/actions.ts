import { z } from 'zod';
import { createClassSchema } from '@home-work/shared';
import { action } from '../../lib/action';
import { context } from '../../lib/firebase-admin';
import { createClass, getRetention } from './service';
export const createClassAction = action('createClass', createClassSchema, (uid, input) => createClass(context, uid, input));
export const getRetentionAction = action('getRetention', z.object({}).strict(), () => getRetention(context));
