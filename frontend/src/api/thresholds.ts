import { get, put } from '@/utils/request';

export interface ThresholdConfig {
  default_visit_days: number;
  satisfaction_standard: number;
  max_unreachable_attempts: number;
  repeat_repair_days: number;
}

export const getThresholds = (): Promise<ThresholdConfig> => {
  return get('/thresholds');
};

export const updateThresholds = (data: ThresholdConfig): Promise<ThresholdConfig> => {
  return put('/thresholds', data);
};
