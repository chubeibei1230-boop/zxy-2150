import { create } from 'zustand';
import { VisitFilter } from '@/types';

interface VisitFilterState {
  filter: VisitFilter;
  setFilter: (filter: Partial<VisitFilter>) => void;
  clearFilter: () => void;
}

export const useVisitFilterStore = create<VisitFilterState>((set) => ({
  filter: {},
  setFilter: (filter) => set({ filter: { ...filter } }),
  clearFilter: () => set({ filter: {} }),
}));
