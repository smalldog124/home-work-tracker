import { subjectSchema } from '@home-work/shared';
import { action } from '../../lib/action';
import { context } from '../../lib/firebase-admin';
import { saveSubject } from './service';
export const saveSubjectAction = action('saveSubject', subjectSchema, (uid, input) => saveSubject(context, uid, input));
