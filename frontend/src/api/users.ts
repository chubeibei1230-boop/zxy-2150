import { get, post, put, del } from '@/utils/request';
import { User } from '@/types';

export const getUsers = (): Promise<User[]> => {
  return get('/users');
};

export const createUser = (data: Partial<User> & { password: string }): Promise<User> => {
  return post('/users', data);
};

export const updateUser = (id: string, data: Partial<User>): Promise<User> => {
  return put(`/users/${id}`, data);
};

export const deleteUser = (id: string): Promise<void> => {
  return del(`/users/${id}`);
};

export const resetPassword = (id: string, password: string): Promise<void> => {
  return post(`/users/${id}/reset-password`, { new_password: password });
};
