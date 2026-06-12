import { get, put } from '@/utils/request';
import { Visit, VisitFilter, PaginatedResponse, ProcessVisitRequest } from '@/types';

export const getVisits = (filter?: VisitFilter): Promise<PaginatedResponse<Visit>> => {
  return get('/visits', { params: filter });
};

export const getVisitDetail = (id: string): Promise<Visit> => {
  return get(`/visits/${id}`);
};

export const processVisit = (id: string, data: ProcessVisitRequest): Promise<Visit> => {
  return put(`/visits/${id}/process`, data);
};
