import { get, post } from '@/utils/request';
import { Warning, WarningFilter, PaginatedResponse, WarningRule, WarningStats } from '@/types';

export const getWarnings = (filter?: WarningFilter): Promise<PaginatedResponse<Warning>> => {
  return get('/warnings', { params: filter });
};

export const getWarningDetail = (id: string): Promise<Warning> => {
  return get(`/warnings/${id}`);
};

export const refreshWarnings = (): Promise<{
  created: number;
  updated: number;
  resolved: number;
  escalated?: number;
  total_active: number;
}> => {
  return post('/warnings/refresh');
};

export const followUpWarning = (
  id: string,
  data: { note: string; action?: string }
): Promise<Warning> => {
  return post(`/warnings/${id}/follow-up`, data);
};

export const resolveWarning = (
  id: string,
  data: { note: string }
): Promise<Warning> => {
  return post(`/warnings/${id}/resolve`, data);
};

export const ignoreWarning = (
  id: string,
  data: { note: string }
): Promise<Warning> => {
  return post(`/warnings/${id}/ignore`, data);
};

export const getWarningStats = (): Promise<WarningStats> => {
  return get('/warnings/stats');
};

export const getWarningRules = (): Promise<WarningRule[]> => {
  return get('/warning-rules');
};

export const getWarningRuleDetail = (id: string): Promise<WarningRule> => {
  return get(`/warning-rules/${id}`);
};

export const createWarningRule = (data: Partial<WarningRule>): Promise<WarningRule> => {
  return post('/warning-rules', data);
};

export const updateWarningRule = (id: string, data: Partial<WarningRule>): Promise<WarningRule> => {
  return post(`/warning-rules/${id}`, data);
};

export const deleteWarningRule = (id: string): Promise<void> => {
  return post(`/warning-rules/${id}/delete`, {});
};
