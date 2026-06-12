import { STATUS_OPTIONS } from '@/types';

export const getStatusLabel = (status: string): string => {
  const option = STATUS_OPTIONS.find(opt => opt.value === status);
  return option?.label || status;
};

export const getStatusColor = (status: string): string => {
  const option = STATUS_OPTIONS.find(opt => opt.value === status);
  return option?.color || 'default';
};

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const getSatisfactionText = (score: number | null): string => {
  if (score === null) return '未评价';
  const stars = '★'.repeat(Math.max(1, Math.min(5, score)));
  const emptyStars = '☆'.repeat(5 - Math.max(1, Math.min(5, score)));
  return `${stars}${emptyStars} ${score}星`;
};
