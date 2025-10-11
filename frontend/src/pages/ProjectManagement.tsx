import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Menu, Transition } from '@headlessui/react';
import {
  ProjectListItem,
  ProjectStage,
  ProjectStatus,
  CreateProjectPayload,
  DeleteProjectOptions
} from '../types/projects';
import { useProjectManagementStore } from '../stores/projectManagementStore';

const ROW_HEIGHT = 72;
const STAGE_LABEL: Record<ProjectStage, string> = {
  planning: '规划中',
  construction: '施工中',
  completed: '已完成',
  archived: '已归档'
};
const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: '活跃',
  archived: '归档',
  deleted: '已删除'
};

const statusTone: Record<ProjectStatus, string> = {
  active: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  archived: 'bg-slate-600/30 text-slate-200 border border-slate-500/40',
  deleted: 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
};

const stageOptions: { label: string; value: ProjectStage | 'all' }[] = [
  { label: '全部阶段', value: 'all' },
  { label: '规划中', value: 'planning' },
  { label: '施工中', value: 'construction' },
  { label: '已完成', value: 'completed' },
  { label: '已归档', value: 'archived' }
];

const statusOptions: { label: string; value: ProjectStatus | 'all' }[] = [
  { label: '全部状态', value: 'all' },
  { label: '活跃', value: 'active' },
  { label: '归档', value: 'archived' },
  { label: '已删除', value: 'deleted' }
];

const ProjectManagement = () => {
  const {
    data,
    totals,
    meta,
    filters,
    pagination,
    selection,
    isLoading,
    fetchProjects,
    setFilters,
    setPagination,
    toggleSelection,
    clearSelection,
    createProject,
    updateProject,
    deleteProject,
    restoreProject,
    bulkArchive,
    bulkRestore
  } = useProjectManagementStore((state) => ({
    data: state.data,
    totals: state.totals,
    meta: state.meta,
    filters: state.filters,
    pagination: state.pagination,
    selection: state.selection,
    isLoading: state.isLoading,
    fetchProjects: state.fetchProjects,
    setFilters: state.setFilters,
    setPagination: state.setPagination,
    toggleSelection: state.toggleSelection,
    clearSelection: state.clearSelection,
    createProject: state.createProject,
    updateProject: state.updateProject,
    deleteProject: state.deleteProject,
    restoreProject: state.restoreProject,
    bulkArchive: state.bulkArchive,
    bulkRestore: state.bulkRestore
  }));

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateProjectPayload>({
    name: '',
    code: '',
    region: '',
    stage: 'planning',
    location: { text: '', lat: undefined, lng: undefined },
    plannedOnlineAt: null,
    description: '',
    includeDefaultMembership: true
  });
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteOptions, setDeleteOptions] = useState<DeleteProjectOptions>({
    archiveLayouts: true,
    keepDeviceMappings: true,
    reason: ''
  });
  const [searchInput, setSearchInput] = useState(filters.keyword);
  const [isSubmitting, setSubmitting] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    const handleResize = () => {
      if (!viewportRef.current) return;
      setViewportHeight(viewportRef.current.clientHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.keyword) {
        void setFilters({ keyword: searchInput });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput, filters.keyword, setFilters]);

  const totalHeight = data.length * ROW_HEIGHT;
  const overscan = 6;
  const visibleRange = useMemo(() => {
    if (viewportHeight === 0) {
      return { start: 0, end: data.length };
    }
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - overscan);
    const endIndex = Math.min(
      data.length,
      Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + overscan
    );
    return { start: startIndex, end: endIndex };
  }, [scrollTop, viewportHeight, data.length]);

  const visibleItems = data.slice(visibleRange.start, visibleRange.end);
  const topSpacer = visibleRange.start * ROW_HEIGHT;
  const bottomSpacer = totalHeight - visibleRange.end * ROW_HEIGHT;

  const allSelected = data.length > 0 && selection.length === data.length;
  const computedPageCount = Math.ceil((totals.total || 0) / pagination.pageSize) || 1;
  const totalPages = Math.max(1, meta?.totalPages ?? computedPageCount);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      code: '',
      region: '',
      stage: 'planning',
      location: { text: '', lat: undefined, lng: undefined },
      plannedOnlineAt: null,
      description: '',
      includeDefaultMembership: true
    });
  };

  const handleCreateSubmit = async () => {
    setSubmitting(true);
    try {
      await createProject({
        ...createForm,
        code: createForm.code.trim().toUpperCase(),
        region: createForm.region?.trim() || undefined,
        location: {
          text: createForm.location?.text?.trim() || undefined,
          lat: createForm.location?.lat,
          lng: createForm.location?.lng
        },
        description: createForm.description?.trim() || undefined
      });
      setCreateOpen(false);
      resetCreateForm();
    } catch (error) {
      console.error('Create project failed', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteTarget) return;
    if (deleteConfirm !== deleteTarget.name) return;
    setSubmitting(true);
    try {
      await deleteProject(deleteTarget.id, {
        archiveLayouts: deleteOptions.archiveLayouts,
        keepDeviceMappings: deleteOptions.keepDeviceMappings,
        reason: deleteOptions.reason
      });
      setDeleteTarget(null);
      setDeleteConfirm('');
    } catch (error) {
      console.error('Delete project failed', error);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      data.forEach((item) => {
        if (!selection.includes(item.id)) {
          toggleSelection(item.id);
        }
      });
    }
  };

  const handleStatusChange = async (project: ProjectListItem, nextStatus: ProjectStatus) => {
    setSubmitting(true);
    try {
      await updateProject(project.id, { status: nextStatus });
    } catch (error) {
      console.error('Update project status failed', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (project: ProjectListItem) => {
    setSubmitting(true);
    try {
      await restoreProject(project.id);
    } catch (error) {
      console.error('Restore project failed', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-white">项目管理</h1>
          <p className="mt-1 text-xs text-slate-400">
            管理工地项目生命周期，支持批量归档、删除与恢复。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded border border-brand-500/70 bg-brand-500/20 px-4 py-2 text-sm font-medium text-brand-100 transition hover:border-brand-400 hover:bg-brand-500/30"
        >
          新建项目
        </button>
      </header>
      <section className="grid grid-cols-1 gap-3 border-b border-slate-800 bg-slate-900/30 px-6 py-4 md:grid-cols-3">
        <StatCard title="项目总数" value={totals.total} accent="text-brand-100" />
        <StatCard title="活跃项目" value={totals.active} accent="text-emerald-200" />
        <StatCard title="待归档/删除" value={totals.archived + totals.deleted} accent="text-amber-200" />
      </section>

      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/50 px-6 py-3 text-sm text-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索名称或站点编号..."
            className="w-60 rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
          />
          <select
            value={filters.status}
            onChange={(event) => void setFilters({ status: event.target.value as ProjectStatus | 'all' })}
            className="rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.stage}
            onChange={(event) => void setFilters({ stage: event.target.value as ProjectStage | 'all' })}
            className="rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
          >
            {stageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={filters.region}
            onChange={(event) => void setFilters({ region: event.target.value })}
            placeholder="按地区过滤"
            className="w-40 rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
          />
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={filters.includeDeleted}
              onChange={(event) => void setFilters({ includeDeleted: event.target.checked })}
              className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-400 focus:ring-brand-400"
            />
            包含已删除
          </label>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>每页</span>
          <select
            value={pagination.pageSize}
            onChange={(event) => void setPagination({ pageSize: Number(event.target.value), page: 1 })}
            className="rounded border border-slate-800/80 bg-slate-900/70 px-2 py-1 text-xs text-slate-200 focus:border-brand-400/80 focus:outline-none"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selection.length > 0 && (
        <div className="flex items-center justify-between border-b border-amber-500/50 bg-amber-500/10 px-6 py-3 text-xs text-amber-200">
          <span>已选择 {selection.length} 个项目</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void bulkArchive()}
              className="rounded border border-amber-400/60 px-3 py-1 text-xs text-amber-100 transition hover:border-amber-300 hover:text-amber-50"
            >
              批量归档
            </button>
            <button
              type="button"
              onClick={() => void bulkRestore()}
              className="rounded border border-emerald-400/60 px-3 py-1 text-xs text-emerald-100 transition hover:border-emerald-300 hover:text-emerald-50"
            >
              批量恢复
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded border border-slate-700/60 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              清除选择
            </button>
          </div>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={viewportRef}
          onScroll={handleScroll}
          className="h-full overflow-auto bg-slate-950/40"
        >
          <table className="min-w-full table-fixed border-separate border-spacing-0 text-sm text-slate-200">
            <thead className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur">
              <tr>
                <th className="w-14 border-b border-slate-800 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-400 focus:ring-brand-400"
                  />
                </th>
                <HeaderCell className="w-64">项目</HeaderCell>
                <HeaderCell className="w-32">站点编号</HeaderCell>
                <HeaderCell className="w-32">地区</HeaderCell>
                <HeaderCell className="w-28">阶段</HeaderCell>
                <HeaderCell className="w-28">状态</HeaderCell>
                <HeaderCell className="w-24 text-right">摄像头</HeaderCell>
                <HeaderCell className="w-24 text-right">布局数</HeaderCell>
                <HeaderCell className="w-40">最近更新</HeaderCell>
                <HeaderCell className="w-32 text-right">操作</HeaderCell>
              </tr>
            </thead>
            <tbody>
              <tr style={{ height: topSpacer }} aria-hidden className="h-[1px]" />
              {isLoading && data.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-slate-500">
                    正在加载项目数据...
                  </td>
                </tr>
              )}
              {!isLoading && data.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-slate-500">
                    未找到符合条件的项目，尝试调整筛选条件。
                  </td>
                </tr>
              )}
              {visibleItems.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  selected={selection.includes(project.id)}
                  toggleSelection={toggleSelection}
                  onArchive={() => void handleStatusChange(project, 'archived')}
                  onRestore={() => void handleRestore(project)}
                  onDelete={() => {
                    setDeleteTarget(project);
                    setDeleteConfirm('');
                    setDeleteOptions({
                      archiveLayouts: true,
                      keepDeviceMappings: true,
                      reason: ''
                    });
                  }}
                />
              ))}
              <tr style={{ height: bottomSpacer }} aria-hidden className="h-[1px]" />
            </tbody>
          </table>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-slate-800 bg-slate-900/30 px-6 py-3 text-xs text-slate-400">
        <div>
          第 {pagination.page} / {totalPages} 页
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => void setPagination({ page: Math.max(1, pagination.page - 1) })}
            className="rounded border border-slate-800 px-3 py-1 text-xs transition hover:border-brand-400/80 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
          >
            上一页
          </button>
          <button
            type="button"
            disabled={pagination.page >= totalPages}
            onClick={() => void setPagination({ page: Math.min(totalPages, pagination.page + 1) })}
            className="rounded border border-slate-800 px-3 py-1 text-xs transition hover:border-brand-400/80 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
          >
            下一页
          </button>
        </div>
      </footer>

      <CreateProjectDrawer
        open={isCreateOpen}
        isSubmitting={isSubmitting}
        onClose={() => {
          setCreateOpen(false);
          resetCreateForm();
        }}
        form={createForm}
        onChange={setCreateForm}
        onSubmit={handleCreateSubmit}
      />
      <DeleteProjectDialog
        open={Boolean(deleteTarget)}
        project={deleteTarget}
        confirmValue={deleteConfirm}
        isSubmitting={isSubmitting}
        options={deleteOptions}
        onClose={() => setDeleteTarget(null)}
        onConfirmChange={setDeleteConfirm}
        onOptionsChange={setDeleteOptions}
        onSubmit={handleDeleteSubmit}
      />
    </div>
  );
};

const HeaderCell = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th
    className={`border-b border-slate-800 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 ${className ?? ''}`}
  >
    {children}
  </th>
);

const ProjectRow = ({
  project,
  selected,
  toggleSelection,
  onArchive,
  onRestore,
  onDelete
}: {
  project: ProjectListItem;
  selected: boolean;
  toggleSelection: (id: string) => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) => {
  return (
    <tr className="border-b border-slate-900/60 hover:bg-slate-900/50">
      <td className="px-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleSelection(project.id)}
          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-400 focus:ring-brand-400"
        />
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-slate-100">{project.name}</div>
        <div className="mt-1 text-xs text-slate-500">
          {project.locationText ?? '未设置地点'}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-300">{project.code}</td>
      <td className="px-4 py-3 text-xs text-slate-300">{project.region ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-slate-300">{STAGE_LABEL[project.stage]}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusTone[project.status]}`}>
          {STATUS_LABEL[project.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-xs text-slate-300">
        {project.deviceCount ?? 0}
      </td>
      <td className="px-4 py-3 text-right text-xs text-slate-300">
        {project.layoutCount ?? 0}
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {project.updatedAt ? new Date(project.updatedAt).toLocaleString() : '—'}
      </td>
      <td className="px-4 py-3 text-right text-xs text-slate-300">
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button className="rounded border border-slate-700/70 px-2 py-1 text-xs text-slate-200 transition hover:border-brand-400/80 hover:text-white">
            操作
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-2 w-36 origin-top-right rounded-md border border-slate-800 bg-slate-900/95 shadow-lg focus:outline-none">
              {project.status !== 'archived' && project.status !== 'deleted' && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={onArchive}
                      className={`${
                        active ? 'bg-slate-800 text-white' : 'text-slate-200'
                      } flex w-full items-center px-3 py-2 text-xs`}
                    >
                      归档项目
                    </button>
                  )}
                </Menu.Item>
              )}
              {project.status !== 'active' && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={onRestore}
                      className={`${
                        active ? 'bg-slate-800 text-white' : 'text-slate-200'
                      } flex w-full items-center px-3 py-2 text-xs`}
                    >
                      恢复项目
                    </button>
                  )}
                </Menu.Item>
              )}
              {project.status !== 'deleted' && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={onDelete}
                      className={`${
                        active ? 'bg-rose-500/20 text-rose-200' : 'text-rose-300'
                      } flex w-full items-center px-3 py-2 text-xs`}
                    >
                      删除项目
                    </button>
                  )}
                </Menu.Item>
              )}
            </Menu.Items>
          </Transition>
        </Menu>
      </td>
    </tr>
  );
};

const StatCard = ({ title, value, accent }: { title: string; value: number; accent: string }) => (
  <div className="rounded border border-slate-800/70 bg-slate-900/50 px-4 py-3">
    <div className="text-xs text-slate-400">{title}</div>
    <div className={`mt-2 text-xl font-semibold ${accent}`}>{value}</div>
  </div>
);

interface CreateProjectDrawerProps {
  open: boolean;
  onClose: () => void;
  form: CreateProjectPayload;
  onChange: (next: CreateProjectPayload) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

const CreateProjectDrawer = ({ open, onClose, form, onChange, onSubmit, isSubmitting }: CreateProjectDrawerProps) => {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-linear duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex justify-end">
          <Transition.Child
            as={Fragment}
            enter="transform transition ease-in-out duration-300"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="transform transition ease-in-out duration-200"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <Dialog.Panel className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950/95 p-6 shadow-2xl">
              <Dialog.Title className="text-lg font-semibold text-white">新建项目</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-slate-400">
                创建后可在画布工作台中配置布局与设备。
              </Dialog.Description>

              <form
                className="mt-6 flex flex-1 flex-col gap-4 overflow-y-auto pr-2 text-sm text-slate-200"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSubmit();
                }}
              >
                <FormField label="项目名称" required>
                  <input
                    value={form.name}
                    onChange={(event) => onChange({ ...form, name: event.target.value })}
                    required
                    maxLength={60}
                    className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                  />
                </FormField>
                <FormField label="站点编号" hint="唯一标识，建议使用大写字母与数字组合" required>
                  <input
                    value={form.code}
                    onChange={(event) => onChange({ ...form, code: event.target.value.toUpperCase() })}
                    required
                    pattern="^[A-Z0-9-]{3,12}$"
                    maxLength={12}
                    className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                  />
                </FormField>
                <FormField label="地区">
                  <input
                    value={form.region ?? ''}
                    onChange={(event) => onChange({ ...form, region: event.target.value })}
                    className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                  />
                </FormField>
                <FormField label="施工阶段">
                  <select
                    value={form.stage ?? 'planning'}
                    onChange={(event) => onChange({ ...form, stage: event.target.value as ProjectStage })}
                    className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                  >
                    {stageOptions
                      .filter((item) => item.value !== 'all')
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </FormField>
                <FormField label="工地地址">
                  <input
                    value={form.location?.text ?? ''}
                    onChange={(event) =>
                      onChange({
                        ...form,
                        location: {
                          ...form.location,
                          text: event.target.value
                        }
                      })
                    }
                    className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="纬度">
                    <input
                      value={form.location?.lat ?? ''}
                      onChange={(event) =>
                        onChange({
                          ...form,
                          location: {
                            ...form.location,
                            lat: event.target.value ? Number(event.target.value) : undefined
                          }
                        })
                      }
                      type="number"
                      step="0.000001"
                      className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                    />
                  </FormField>
                  <FormField label="经度">
                    <input
                      value={form.location?.lng ?? ''}
                      onChange={(event) =>
                        onChange({
                          ...form,
                          location: {
                            ...form.location,
                            lng: event.target.value ? Number(event.target.value) : undefined
                          }
                        })
                      }
                      type="number"
                      step="0.000001"
                      className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                    />
                  </FormField>
                </div>
                <FormField label="计划上线日期">
                  <input
                    value={form.plannedOnlineAt ?? ''}
                    onChange={(event) => onChange({ ...form, plannedOnlineAt: event.target.value || null })}
                    type="date"
                    className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                  />
                </FormField>
                <FormField label="备注">
                  <textarea
                    value={form.description ?? ''}
                    onChange={(event) => onChange({ ...form, description: event.target.value })}
                    rows={3}
                    className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                  />
                </FormField>
                <label className="flex items-center gap-3 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.includeDefaultMembership ?? true}
                    onChange={(event) => onChange({ ...form, includeDefaultMembership: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-400 focus:ring-brand-400"
                  />
                  将创建者加入项目成员
                </label>
              </form>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded border border-slate-700/70 px-4 py-2 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
                  disabled={isSubmitting}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="rounded border border-brand-500/70 bg-brand-500/20 px-4 py-2 text-xs font-medium text-brand-100 transition hover:border-brand-400 hover:bg-brand-500/30 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-transparent disabled:text-slate-500"
                >
                  {isSubmitting ? '提交中...' : '创建'}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

interface DeleteProjectDialogProps {
  open: boolean;
  project: ProjectListItem | null;
  confirmValue: string;
  onConfirmChange: (value: string) => void;
  options: DeleteProjectOptions;
  onOptionsChange: (next: DeleteProjectOptions) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

const DeleteProjectDialog = ({
  open,
  project,
  confirmValue,
  onConfirmChange,
  options,
  onOptionsChange,
  onClose,
  onSubmit,
  isSubmitting
}: DeleteProjectDialogProps) => {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-40">
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-linear duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center px-4">
          <Transition.Child
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <Dialog.Panel className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-950/95 p-6 shadow-xl">
              <Dialog.Title className="text-lg font-semibold text-white">删除项目</Dialog.Title>
              <Dialog.Description className="mt-2 text-xs text-rose-200">
                删除操作将项目状态标记为「已删除」，并可在 30 天内恢复。要继续，请输入项目名称确认。
              </Dialog.Description>

              <div className="mt-4 space-y-4 text-sm text-slate-200">
                <div>
                  <div className="text-xs text-slate-400">项目名称</div>
                  <div className="mt-1 text-sm font-medium text-slate-100">{project?.name ?? '—'}</div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={options.archiveLayouts ?? true}
                    onChange={(event) =>
                      onOptionsChange({
                        ...options,
                        archiveLayouts: event.target.checked
                      })
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-400 focus:ring-brand-400"
                  />
                  同时归档所有布局版本
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={options.keepDeviceMappings ?? true}
                    onChange={(event) =>
                      onOptionsChange({
                        ...options,
                        keepDeviceMappings: event.target.checked
                      })
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-400 focus:ring-brand-400"
                  />
                  保留设备映射，方便后续恢复
                </label>
                <div>
                  <div className="text-xs text-slate-400">删除理由（可选）</div>
                  <input
                    value={options.reason ?? ''}
                    onChange={(event) =>
                      onOptionsChange({
                        ...options,
                        reason: event.target.value
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-rose-400/80 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-400">输入项目名称确认删除</div>
                  <input
                    value={confirmValue}
                    onChange={(event) => onConfirmChange(event.target.value)}
                    className="mt-1 w-full rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 focus:border-rose-300/70 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded border border-slate-700/70 px-4 py-2 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={confirmValue !== project?.name || isSubmitting}
                  onClick={onSubmit}
                  className="rounded border border-rose-500/70 bg-rose-500/20 px-4 py-2 text-xs font-medium text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-transparent disabled:text-slate-500"
                >
                  {isSubmitting ? '处理中...' : '确认删除'}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

const FormField = ({
  label,
  children,
  hint,
  required
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) => (
  <label className="flex flex-col gap-1 text-xs text-slate-300">
    <span className="flex items-center gap-1">
      {label}
      {required && <span className="text-rose-300">*</span>}
    </span>
    {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
    {children}
  </label>
);

export default ProjectManagement;
