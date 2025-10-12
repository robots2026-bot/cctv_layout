import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '../utils/apiClient';
import {
  CreateProjectPayload,
  DeleteProjectOptions,
  ProjectDetail,
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
  communicationRange: [number, number] | null;
}

interface ProjectPagination {
  page: number;
  pageSize: number;
}

interface ProjectSorting {
  field: 'name' | 'updatedAt';
  order: 'asc' | 'desc';
}

interface ProjectManagementState {
  data: ProjectListItem[];
  totals: ProjectListTotals;
  meta: ProjectListMeta | null;
  filters: ProjectFilters;
  pagination: ProjectPagination;
  sorting: ProjectSorting;
  isLoading: boolean;
  isDetailLoading: boolean;
  activeProjectId: string | null;
  activeProject: ProjectDetail | null;
  fetchProjects: () => Promise<void>;
  setFilters: (partial: Partial<ProjectFilters>) => Promise<void>;
  setPagination: (partial: Partial<ProjectPagination>) => Promise<void>;
  setSorting: (sorting: ProjectSorting) => Promise<void>;
  setActiveProject: (projectId: string | null) => Promise<void>;
  fetchProjectDetail: (projectId: string) => Promise<ProjectDetail | null>;
  createProject: (payload: CreateProjectPayload) => Promise<void>;
  updateProject: (projectId: string, payload: UpdateProjectPayload) => Promise<void>;
  deleteProject: (projectId: string, options: DeleteProjectOptions) => Promise<void>;
  restoreProject: (projectId: string, reason?: string) => Promise<void>;
}

const initialFilters: ProjectFilters = {
  keyword: '',
  status: 'all',
  stage: 'all',
  region: '',
  includeDeleted: false,
  communicationRange: null
};

const initialSorting: ProjectSorting = {
  field: 'updatedAt',
  order: 'desc'
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
      sorting: initialSorting,
      isLoading: false,
      isDetailLoading: false,
      activeProjectId: null,
      activeProject: null,

      fetchProjects: async () => {
        const { filters, pagination, sorting } = get();
        set({ isLoading: true });
        try {
          const params: Record<string, unknown> = {
            page: pagination.page,
            pageSize: pagination.pageSize,
            includeDeleted: filters.includeDeleted || filters.status === 'deleted',
            keyword: filters.keyword || undefined,
            status: filters.status !== 'all' ? filters.status : undefined,
            stage: filters.stage !== 'all' ? filters.stage : undefined,
            region: filters.region || undefined,
            orderBy: sorting.field,
            order: sorting.order
          };

          if (filters.communicationRange) {
            params.codeGte = filters.communicationRange[0];
            params.codeLte = filters.communicationRange[1];
          }

          const response = await apiClient.get<ProjectListResponse>('/projects', { params });
          const { meta, totals, items } = response.data;

          const clampedPage =
            meta.totalPages > 0 ? Math.min(meta.totalPages, pagination.page) : pagination.page;
          if (clampedPage !== pagination.page) {
            set((state) => ({
              pagination: { ...state.pagination, page: clampedPage }
            }));
            set({ isLoading: false });
            await get().fetchProjects();
            return;
          }

          set({
            data: items ?? [],
            totals,
            meta,
            isLoading: false
          });

          const activeId = get().activeProjectId;
          if (activeId && !(items ?? []).some((item) => item.id === activeId)) {
            set({ activeProjectId: null, activeProject: null });
          }
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

      setSorting: async (sorting) => {
        set({ sorting, pagination: { page: 1, pageSize: get().pagination.pageSize } });
        await get().fetchProjects();
      },

      fetchProjectDetail: async (projectId) => {
        try {
          const response = await apiClient.get<ProjectDetail>(`/projects/${projectId}`);
          return response.data;
        } catch (error) {
          console.error('Failed to fetch project detail', error);
          notify('加载详情失败', '无法获取项目详情，请稍后重试。', 'error');
          return null;
        }
      },

      setActiveProject: async (projectId) => {
        if (!projectId) {
          set({ activeProjectId: null, activeProject: null });
          return;
        }
        set({ activeProjectId: projectId, isDetailLoading: true });
        const detail = await get().fetchProjectDetail(projectId);
        if (detail) {
          set({
            activeProject: detail,
            isDetailLoading: false
          });
        } else {
          set({
            activeProjectId: null,
            activeProject: null,
            isDetailLoading: false
          });
        }
      },

      createProject: async (payload) => {
        try {
          const trimmedCode = payload.code.trim();
          const codeIsNumeric = /^\d+$/.test(trimmedCode);
          const numericCode = Number(trimmedCode);
          if (!codeIsNumeric || Number.isNaN(numericCode) || numericCode < 0 || numericCode > 255) {
            notify('通信 ID 不合法', '通信 ID 需为 0-255 的整数。', 'error');
            throw new Error('Invalid communication ID');
          }

          const body: Record<string, unknown> = {
            name: payload.name.trim(),
            code: numericCode,
            includeDefaultMembership: payload.includeDefaultMembership ?? true
          };

          if (payload.stage) {
            body.stage = payload.stage;
          }
          if (payload.region?.trim()) {
            body.region = payload.region.trim();
          }
          if (payload.description?.trim()) {
            body.description = payload.description.trim();
          }
          if (payload.plannedOnlineAt) {
            body.plannedOnlineAt = payload.plannedOnlineAt;
          }
          if (payload.createdBy) {
            body.createdBy = payload.createdBy;
          }
          if (payload.location) {
            const location: Record<string, unknown> = {};
            if (payload.location.text?.trim()) {
              location.text = payload.location.text.trim();
            }
            if (typeof payload.location.lat === 'number' && !Number.isNaN(payload.location.lat)) {
              location.lat = payload.location.lat;
            }
            if (typeof payload.location.lng === 'number' && !Number.isNaN(payload.location.lng)) {
              location.lng = payload.location.lng;
            }
            if (Object.keys(location).length > 0) {
              body.location = location;
            }
          }

          await apiClient.post('/projects', body);
          notify('项目已创建', `项目 ${payload.name.trim()} 创建成功。`, 'info');
          await get().fetchProjects();
          await useProjectStore.getState().fetchProjects({ silent: true });
        } catch (error) {
          console.error('Failed to create project', error);
          if (!(error instanceof Error) || error.message !== 'Invalid communication ID') {
            notify('创建失败', '创建项目时发生错误，请检查参数后重试。', 'error');
          }
          throw error;
        }
      },

      updateProject: async (projectId, payload) => {
        try {
          await apiClient.patch(`/projects/${projectId}`, payload);
          notify('项目已更新', '项目信息已同步。', 'info');
          await get().fetchProjects();
          await useProjectStore.getState().fetchProjects({ silent: true });
          if (get().activeProjectId === projectId) {
            const detail = await get().fetchProjectDetail(projectId);
            set({ activeProject: detail });
          }
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
          if (get().activeProjectId === projectId) {
            set({ activeProjectId: null, activeProject: null });
          }
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
          if (get().activeProjectId === projectId) {
            const detail = await get().fetchProjectDetail(projectId);
            set({ activeProject: detail });
          }
        } catch (error) {
          console.error('Failed to restore project', error);
          notify('恢复失败', '恢复项目时发生错误。', 'error');
          throw error;
        }
      }
    }),
    { name: 'project-management-store' }
  )
);
