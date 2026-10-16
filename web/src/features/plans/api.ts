import { useQuery } from '@tanstack/react-query';
import { planSummarySchema, planPreviewSchema, planRedemptionSchema, previewPlanCodeSchema, redeemPlanCodeSchema, type PlanPreview, type PlanRedemption, type PlanSummary } from '@home-work/shared';
import { call } from '@/lib/api';
import { useAuth } from '../auth/useAuth';
export function usePlan() {
  const { user } = useAuth();
  return useQuery({ queryKey: [user!.uid, 'plan'], queryFn: async () => planSummarySchema.parse(await call<PlanSummary>('getPlanSummary', {})), refetchInterval: 60000 });
}
export const previewCode = async (code: string) => planPreviewSchema.parse(await call<PlanPreview>('previewPlanCode', { code }, previewPlanCodeSchema));
export const redeemCode = async (input: { code: string; requestId: string; previewToken: string }) => planRedemptionSchema.parse(await call<PlanRedemption>('redeemPlanCode', input, redeemPlanCodeSchema));
