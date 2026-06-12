import { get } from '@/utils/request';
import { DashboardStats } from '@/types';

export const getDashboardStats = (): Promise<DashboardStats> => {
  return get('/stats/dashboard');
};
