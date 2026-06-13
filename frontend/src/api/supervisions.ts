import { get, post } from '@/utils/request';
import { Supervision, SupervisionFilter, PaginatedResponse, SupervisionStats } from '@/types';

export const getSupervisions = (filter?: SupervisionFilter): Promise<PaginatedResponse<Supervision>> => {
  return get('/supervisions', { params: filter });
};

export const getSupervisionDetail = (id: string): Promise<Supervision> => {
  return get(`/supervisions/${id}`);
};

export const generateSupervisions = (): Promise<{
  created: number;
  updated: number;
  resolved: number;
  total_active: number;
}> => {
  return post('/supervisions/generate');
};

export const followUpSupervision = (
  id: string,
  data: { note: string; action?: string }
): Promise<Supervision> => {
  return post(`/supervisions/${id}/follow-up`, data);
};

export const resolveSupervision = (
  id: string,
  data: { note: string }
): Promise<Supervision> => {
  return post(`/supervisions/${id}/resolve`, data);
};

export const reassignSupervision = (
  id: string,
  data: { assignee_id: string; note?: string }
): Promise<Supervision> => {
  return post(`/supervisions/${id}/reassign`, data);
};

export const closeSupervision = (
  id: string,
  data: { note: string }
): Promise<Supervision> => {
  return post(`/supervisions/${id}/close`, data);
};

export const dismissSupervision = (
  id: string,
  data: { note: string }
): Promise<Supervision> => {
  return post(`/supervisions/${id}/dismiss`, data);
};

export const getSupervisionStats = (): Promise<SupervisionStats> => {
  return get('/supervisions/stats');
};
