import { post, get } from '@/utils/request';
import { User } from '@/types';

export const login = (username: string, password: string): Promise<{ token: string; user: User }> => {
  return post('/auth/login', { username, password });
};

export const getCurrentUser = (): Promise<User> => {
  return get('/auth/me');
};
