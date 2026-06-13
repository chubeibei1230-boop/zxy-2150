import { get, put } from '@/utils/request';

export interface ThresholdConfig {
  default_visit_days: number;
  satisfaction_standard: number;
  max_unreachable_attempts: number;
  repeat_repair_days: number;
  warning_pending_days: number;
  warning_low_satisfaction: number;
  warning_unreachable_count: number;
  warning_reprocess_days: number;
  warning_follow_up_days: number;
  warning_escalation_days: number;
}

export const getThresholds = (): Promise<ThresholdConfig> => {
  return get('/thresholds');
};

export const updateThresholds = (data: ThresholdConfig): Promise<ThresholdConfig> => {
  return put('/thresholds', data);
};
