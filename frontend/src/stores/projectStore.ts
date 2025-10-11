import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '../utils/apiClient';
import { ProjectListItem, ProjectListResponse, ProjectStatus } from '../types/projects';

interface FetchProjectsOptions {
  includeDeleted?: boolean;
  status?: ProjectStatus;
  silent?: boolean;
}

interface ProjectState {
  projects: ProjectListItem[];
  isLoading: boolean;
  lastFetchedAt?: number;
  fetchProjects: (options?: FetchProjectsOptions) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()(
  devtools((set) => ({
    projects: [],
    isLoading: false,
    lastFetchedAt: undefined,
    fetchProjects: async (options) => {
      const shouldShowLoading = !(options?.silent ?? false);
      if (shouldShowLoading) {
        set({ isLoading: true });
      }
      try {
        const params = {
          page: 1,
          pageSize: 200,
          status: options?.status ?? 'active',
          includeDeleted: options?.includeDeleted ?? false
        };
        const response = await apiClient.get<ProjectListResponse>('/projects', { params });
        const list = Array.isArray(response.data?.items) ? response.data.items : [];
        set({
          projects: list,
          isLoading: false,
          lastFetchedAt: Date.now()
        });
      } catch (error) {
        console.error('Failed to load projects', error);
        set({ isLoading: false });
      }
    }
  }))
);
