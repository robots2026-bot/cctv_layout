import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { isAxiosError } from 'axios';
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
  devtools((set, get) => ({
    projects: [],
    isLoading: false,
    lastFetchedAt: undefined,
    fetchProjects: async (options) => {
      const shouldShowLoading = !(options?.silent ?? false);
      if (shouldShowLoading) {
        set({ isLoading: true });
      }

      const buildParams = (disableCache: boolean) => ({
        page: 1,
        pageSize: 200,
        status: options?.status ?? 'active',
        includeDeleted: options?.includeDeleted ?? false,
        ...(disableCache
          ? {
              _ts: Date.now()
            }
          : {})
      });

      const runRequest = (disableCache: boolean) => {
        const params = buildParams(disableCache);
        const headers = disableCache
          ? {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
              'If-Modified-Since': '0'
            }
          : undefined;
        return apiClient.get<ProjectListResponse>('/projects', {
          params,
          headers
        });
      };

      const applySuccessfulResponse = (response: ProjectListResponse) => {
        const list = Array.isArray(response.items) ? response.items : [];
        set({
          projects: list,
          isLoading: false,
          lastFetchedAt: Date.now()
        });
      };

      const markFetchedWithoutUpdate = () => {
        set({
          isLoading: false,
          lastFetchedAt: Date.now()
        });
      };

      const fallbackFetchIfEmpty = async () => {
        const currentProjects = get().projects;
        if (currentProjects.length > 0) {
          markFetchedWithoutUpdate();
          return;
        }
        try {
          const fallbackResponse = await runRequest(true);
          if (fallbackResponse.status === 304) {
            markFetchedWithoutUpdate();
            return;
          }
          applySuccessfulResponse(fallbackResponse.data);
        } catch (fallbackError) {
          console.error('Fallback request for projects failed', fallbackError);
          set({ isLoading: false });
        }
      };

      try {
        const response = await runRequest(false);
        if (response.status === 304) {
          await fallbackFetchIfEmpty();
          return;
          }
        applySuccessfulResponse(response.data);
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 304) {
          await fallbackFetchIfEmpty();
          return;
        }
        console.error('Failed to load projects', error);
        set({ isLoading: false });
      }
    }
  }))
);
