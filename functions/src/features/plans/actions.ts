import { getPlanSummarySchema, previewPlanCodeSchema, redeemPlanCodeSchema } from '@home-work/shared';
import { action } from '../../lib/action';
import { context } from '../../lib/firebase-admin';
import { getPlanSummary, previewPlanCode, redeemPlanCode } from './service';
export const getPlanSummaryAction = action('getPlanSummary', getPlanSummarySchema, uid => getPlanSummary(context, uid));
export const previewPlanCodeAction = action('previewPlanCode', previewPlanCodeSchema, (uid, input) => previewPlanCode(context, uid, input));
export const redeemPlanCodeAction = action('redeemPlanCode', redeemPlanCodeSchema, (uid, input) => redeemPlanCode(context, uid, input));
