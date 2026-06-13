import { get } from '@/utils/request';
import { WorkbenchStats, WorkbenchItem, WorkbenchFilter, PaginatedResponse } from '@/types';

export const getWorkbenchStats = (): Promise<WorkbenchStats> => {
  return get('/workbench/stats');
};

export const getWorkbenchItems = (filter?: WorkbenchFilter): Promise<PaginatedResponse<WorkbenchItem>> => {
  return get('/workbench/items', { params: filter });
};
