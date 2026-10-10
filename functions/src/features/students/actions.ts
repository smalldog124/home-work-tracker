import { addStudentSchema, updateStudentSchema, toggleStudentSchema, importStudentsSchema } from '@home-work/shared';
import { action } from '../../lib/action';
import { context } from '../../lib/firebase-admin';
import { addStudent, updateStudent, setStudentActive } from './service';
import { importStudents } from './import';
export const addStudentAction = action('addStudent', addStudentSchema, (uid, input) => addStudent(context, uid, input));
export const updateStudentAction = action('updateStudent', updateStudentSchema, (uid, input) => updateStudent(context, uid, input));
export const setStudentActiveAction = action('setStudentActive', toggleStudentSchema, (uid, input) => setStudentActive(context, uid, input));
export const importStudentsAction = action('importStudents', importStudentsSchema, (uid, input) => importStudents(context, uid, input));
