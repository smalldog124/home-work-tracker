import { z } from 'zod';
import { id, requestId, text } from './student';

export const PLAN_DEFINITIONS = {
  starter: { name: 'Starter', rank: 0, classroomLimit: 2 },
  level1: { name: 'Level 1', rank: 1, classroomLimit: 6 },
  level2: { name: 'Level 2', rank: 2, classroomLimit: 15 },
  level3: { name: 'Level 3', rank: 3, classroomLimit: null },
} as const;
export const planIdSchema = z.enum(['starter', 'level1', 'level2', 'level3']);
export const paidPlanIdSchema = z.enum(['level1', 'level2', 'level3']);
export type PlanId = z.infer<typeof planIdSchema>;
export type PaidPlanId = z.infer<typeof paidPlanIdSchema>;
export const planCodeSchema = z.string().trim().toUpperCase().regex(/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{5}$/, 'กรอกโค้ดภาษาอังกฤษผสมตัวเลข 5 ตัว เช่น A7K2P');
const code = planCodeSchema;
export const previewPlanCodeSchema = z.object({ code }).strict();
export const redeemPlanCodeSchema = z.object({ requestId, code, previewToken: z.string().min(1).max(256) }).strict();
export const planSummarySchema = z.object({
  planId: planIdSchema, expiresAt: z.iso.datetime().nullable(), schoolYear: z.number().int(),
  classroomCount: z.number().int().nonnegative(), classroomLimit: z.number().int().positive().nullable(),
}).strict();
export const planPreviewSchema = z.object({
  planId: paidPlanIdSchema, expiresAt: z.iso.datetime(), previewToken: z.string(),
  change: z.enum(['activation', 'renewal', 'upgrade']),
}).strict();
export const planRedemptionSchema = z.object({ planId: paidPlanIdSchema, expiresAt: z.iso.datetime() }).strict();
export const deleteClassSchema = z.object({ requestId, classId: id, confirmationName: text }).strict();
export const deleteClassResultSchema = z.object({ classId: id, status: z.literal('deleting') }).strict();
export const getPlanSummarySchema = z.object({}).strict();
export type PlanSummary = z.infer<typeof planSummarySchema>;
export type PlanPreview = z.infer<typeof planPreviewSchema>;
export type PlanRedemption = z.infer<typeof planRedemptionSchema>;
export const classroomDisplayName = (subject: string, group: string) => `${subject} · ${group}`;
