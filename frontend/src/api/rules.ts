import { get, post, put, del } from '@/utils/request';
import { Rule } from '@/types';

export const getRules = (): Promise<Rule[]> => {
  return get('/rules');
};

export const createRule = (data: Partial<Rule>): Promise<Rule> => {
  return post('/rules', data);
};

export const updateRule = (id: string, data: Partial<Rule>): Promise<Rule> => {
  return put(`/rules/${id}`, data);
};

export const deleteRule = (id: string): Promise<void> => {
  return del(`/rules/${id}`);
};
