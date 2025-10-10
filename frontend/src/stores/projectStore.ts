import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '../utils/apiClient';

type Project = {
  id: string;
  name: string;
  location?: string;
  updatedAt?: string;
  defaultLayoutId?: string;
};

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  fetchProjects: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>()(
  devtools((set) => ({
    projects: [],
    isLoading: false,
    fetchProjects: async () => {
      set({ isLoading: true });
      try {
        const response = await apiClient.get<Project[]>('/projects');
        const list = Array.isArray(response.data) ? response.data : [];
        set({ projects: list, isLoading: false });
      } catch (error) {
        console.error('Failed to load projects', error);
        set({ isLoading: false });
      }
    }
  }))
);
