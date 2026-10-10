import { resolveQrSchema, qrDownloadSchema } from '@home-work/shared';
import { action } from '../../lib/action';
import { context } from '../../lib/firebase-admin';
import { resolveQr, getQrData } from './service';
export const resolveQrAction = action('resolveQr', resolveQrSchema, (uid, input) => resolveQr(context, uid, input.payload));
export const getQrDataAction = action('getQrData', qrDownloadSchema, (uid, input) => getQrData(context, uid, input.classId, input.studentId));
