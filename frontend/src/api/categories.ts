import { get, post, put, del } from '@/utils/request';
import { Category } from '@/types';

export const getCategories = (): Promise<Category[]> => {
  return get('/categories');
};

export const createCategory = (data: Partial<Category>): Promise<Category> => {
  return post('/categories', data);
};

export const updateCategory = (id: string, data: Partial<Category>): Promise<Category> => {
  return put(`/categories/${id}`, data);
};

export const deleteCategory = (id: string): Promise<void> => {
  return del(`/categories/${id}`);
};
