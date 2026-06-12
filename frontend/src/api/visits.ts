import { get, post } from '@/utils/request';
import { Visit, VisitFilter, PaginatedResponse, ProcessVisitRequest } from '@/types';

export const getVisits = (filter?: VisitFilter): Promise<PaginatedResponse<Visit>> => {
  return get('/visits', { params: filter });
};

export const getVisitDetail = (id: string): Promise<Visit> => {
  return get(`/visits/${id}`);
};

export const processVisit = (id: string, data: ProcessVisitRequest): Promise<Visit> => {
  return post(`/visits/${id}/process`, data);
};

export const generateReminders = (): Promise<{ created_count: number; items: Visit[] }> => {
  return post('/visits/generate-reminders');
};
