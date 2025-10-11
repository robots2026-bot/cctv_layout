import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '../utils/apiClient';
import {
  CreateProjectPayload,
  DeleteProjectOptions,
  ProjectListItem,
  ProjectListMeta,
  ProjectListResponse,
  ProjectListTotals,
  ProjectStage,
  ProjectStatus,
  UpdateProjectPayload
} from '../types/projects';
import { useProjectStore } from './projectStore';
import { useUIStore } from './uiStore';

interface ProjectFilters {
  keyword: string;
  status: ProjectStatus | 'all';
  stage: ProjectStage | 'all';
  region: string;
  includeDeleted: boolean;
}

interface ProjectPagination {
  page: number;
  pageSize: number;
}

interface ProjectManagementState {
  data: ProjectListItem[];
  totals: ProjectListTotals;
  meta: ProjectListMeta | null;
  filters: ProjectFilters;
  pagination: ProjectPagination;
  selection: string[];
  isLoading: boolean;
  fetchProjects: () => Promise<void>;
  setFilters: (partial: Partial<ProjectFilters>) => Promise<void>;
  setPagination: (partial: Partial<ProjectPagination>) => Promise<void>;
  toggleSelection: (projectId: string) => void;
  clearSelection: () => void;
  createProject: (payload: CreateProjectPayload) => Promise<void>;
  updateProject: (projectId: string, payload: UpdateProjectPayload) => Promise<void>;
  deleteProject: (projectId: string, options: DeleteProjectOptions) => Promise<void>;
  restoreProject: (projectId: string, reason?: string) => Promise<void>;
  bulkArchive: () => Promise<void>;
  bulkRestore: () => Promise<void>;
}

const initialFilters: ProjectFilters = {
  keyword: '',
  status: 'all',
  stage: 'all',
  region: '',
  includeDeleted: false
};

const notify = (title: string, message: string, level: 'info' | 'warning' | 'error' = 'info') => {
  const addNotification = useUIStore.getState().addNotification;
  addNotification({
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    title,
    message,
    level
  });
};

export const useProjectManagementStore = create<ProjectManagementState>()(
  devtools(
    (set, get) => ({
      data: [],
      totals: { total: 0, active: 0, archived: 0, deleted: 0 },
      meta: null,
      filters: initialFilters,
      pagination: { page: 1, pageSize: 20 },
      selection: [],
      isLoading: false,

      fetchProjects: async () => {
        const { filters, pagination } = get();
        set({ isLoading: true });
        try {
          const params = {
            page: pagination.page,
            pageSize: pagination.pageSize,
            includeDeleted: filters.includeDeleted || filters.status === 'deleted',
            keyword: filters.keyword || undefined,
            status: filters.status !== 'all' ? filters.status : undefined,
            stage: filters.stage !== 'all' ? filters.stage : undefined,
            region: filters.region || undefined
          };
          const response = await apiClient.get<ProjectListResponse>('/projects', { params });
          const meta = response.data.meta;
          const totals = response.data.totals;
          const items = response.data.items ?? [];
          const currentSelection = get().selection;

          // Clamp page if out of range and refetch
          if (meta.totalPages > 0 && pagination.page > meta.totalPages) {
            set((state) => ({
              pagination: { ...state.pagination, page: Math.max(1, meta.totalPages) }
            }));
            set({ isLoading: false });
            await get().fetchProjects();
            return;
          }

          set({
            data: items,
            totals,
            meta,
            isLoading: false,
            selection: items.length === 0 ? [] : currentSelection.filter((id) => items.some((item) => item.id === id))
          });
        } catch (error) {
          console.error('Failed to fetch project list', error);
          set({ isLoading: false });
          notify('加载失败', '无法获取项目列表，请稍后重试。', 'error');
        }
      },

      setFilters: async (partial) => {
        set((state) => ({
          filters: { ...state.filters, ...partial },
          pagination: { ...state.pagination, page: 1 }
        }));
        await get().fetchProjects();
      },

      setPagination: async (partial) => {
        set((state) => ({
          pagination: { ...state.pagination, ...partial }
        }));
        await get().fetchProjects();
      },

      toggleSelection: (projectId) => {
        set((state) => {
          const exists = state.selection.includes(projectId);
          return {
            selection: exists
              ? state.selection.filter((id) => id !== projectId)
              : [...state.selection, projectId]
          };
        });
      },

      clearSelection: () => set({ selection: [] }),

      createProject: async (payload) => {
        try {
          await apiClient.post('/projects', payload);
          notify('项目已创建', `项目 ${payload.name} 创建成功。`, 'info');
          await get().fetchProjects();
          await useProjectStore.getState().fetchProjects({ silent: true });
        } catch (error) {
          console.error('Failed to create project', error);
          notify('创建失败', '创建项目时发生错误，请检查参数后重试。', 'error');
          throw error;
        }
      },

      updateProject: async (projectId, payload) => {
        try {
          await apiClient.patch(`/projects/${projectId}`, payload);
          await get().fetchProjects();
          await useProjectStore.getState().fetchProjects({ silent: true });
          notify('项目已更新', '项目信息已同步。', 'info');
        } catch (error) {
          console.error('Failed to update project', error);
          notify('更新失败', '更新项目时发生错误。', 'error');
          throw error;
        }
      },

      deleteProject: async (projectId, options) => {
        try {
          await apiClient.delete(`/projects/${projectId}`, {
            data: {
              archiveLayouts: options.archiveLayouts ?? true,
              keepDeviceMappings: options.keepDeviceMappings ?? true,
              reason: options.reason ? options.reason.trim() : undefined
            }
          });
          notify('项目已删除', '项目已移入删除状态。', 'warning');
          await get().fetchProjects();
          await useProjectStore.getState().fetchProjects({ silent: true });
        } catch (error) {
          console.error('Failed to delete project', error);
          notify('删除失败', '删除项目时发生错误。', 'error');
          throw error;
        }
      },

      restoreProject: async (projectId, reason) => {
        try {
          await apiClient.post(`/projects/${projectId}/restore`, { reason });
          notify('项目已恢复', '项目已恢复为活跃状态。', 'info');
          await get().fetchProjects();
          await useProjectStore.getState().fetchProjects({ silent: true });
        } catch (error) {
          console.error('Failed to restore project', error);
          notify('恢复失败', '恢复项目时发生错误。', 'error');
          throw error;
        }
      },

      bulkArchive: async () => {
        const { selection } = get();
        if (selection.length === 0) return;
        try {
          await apiClient.post('/projects/bulk', { action: 'archive', ids: selection });
          notify('批量归档成功', `已归档 ${selection.length} 个项目。`, 'info');
          set({ selection: [] });
          await get().fetchProjects();
          await useProjectStore.getState().fetchProjects({ silent: true });
        } catch (error) {
          console.error('Failed to bulk archive projects', error);
          notify('批量归档失败', '批量归档项目时发生错误。', 'error');
          throw error;
        }
      },

      bulkRestore: async () => {
        const { selection } = get();
        if (selection.length === 0) return;
        try {
          await apiClient.post('/projects/bulk', { action: 'restore', ids: selection });
          notify('批量恢复成功', `已恢复 ${selection.length} 个项目。`, 'info');
          set({ selection: [] });
          await get().fetchProjects();
          await useProjectStore.getState().fetchProjects({ silent: true });
        } catch (error) {
          console.error('Failed to bulk restore projects', error);
          notify('批量恢复失败', '批量恢复项目时发生错误。', 'error');
          throw error;
        }
      }
    }),
    { name: 'project-management-store' }
  )
);
