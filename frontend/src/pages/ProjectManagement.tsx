import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Menu, Transition } from '@headlessui/react';
import { Link } from 'react-router-dom';
import {
  CreateProjectPayload,
  DeleteProjectOptions,
  ProjectDetail,
  ProjectListItem,
  ProjectStage,
  ProjectStatus
} from '../types/projects';
import { useProjectManagementStore } from '../stores/projectManagementStore';

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

const sortOptions = [
  { value: 'updatedAt_desc', label: '最近更新' },
  { value: 'updatedAt_asc', label: '最早更新' },
  { value: 'name_asc', label: '名称 A-Z' },
  { value: 'name_desc', label: '名称 Z-A' }
] as const;

const ProjectManagement = () => {
  const {
    data,
    totals,
    filters,
    pagination,
    sorting,
    isLoading,
    isDetailLoading,
    activeProjectId,
    activeProject,
    fetchProjects,
    setFilters,
    setPagination,
    setSorting,
    setActiveProject,
    createProject,
    updateProject,
    deleteProject,
    restoreProject
  } = useProjectManagementStore((state) => ({
    data: state.data,
    totals: state.totals,
    filters: state.filters,
    pagination: state.pagination,
    sorting: state.sorting,
    isLoading: state.isLoading,
    isDetailLoading: state.isDetailLoading,
    activeProjectId: state.activeProjectId,
    activeProject: state.activeProject,
    fetchProjects: state.fetchProjects,
    setFilters: state.setFilters,
    setPagination: state.setPagination,
    setSorting: state.setSorting,
    setActiveProject: state.setActiveProject,
    createProject: state.createProject,
    updateProject: state.updateProject,
    deleteProject: state.deleteProject,
    restoreProject: state.restoreProject
  }));

  const [searchValue, setSearchValue] = useState(filters.keyword);
  const [commMin, setCommMin] = useState<string>(filters.communicationRange?.[0]?.toString() ?? '');
  const [commMax, setCommMax] = useState<string>(filters.communicationRange?.[1]?.toString() ?? '');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateProjectPayload>({
    name: '',
    code: '',
    region: '',
    stage: 'planning',
    location: { text: '', lat: undefined, lng: undefined },
    plannedOnlineAt: undefined,
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
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchValue !== filters.keyword) {
        void setFilters({ keyword: searchValue });
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchValue, filters.keyword, setFilters]);

  useEffect(() => {
    if (!filters.communicationRange) {
      setCommMin('');
      setCommMax('');
      return;
    }
    const [min, max] = filters.communicationRange;
    setCommMin(String(min));
    setCommMax(String(max));
  }, [filters.communicationRange]);

  const currentSortValue = useMemo(() => `${sorting.field}_${sorting.order}`, [sorting]);

  const parsedCommunicationRange = useMemo(() => {
    if (!commMin && !commMax) {
      return null;
    }
    const min = commMin === '' ? 0 : Number(commMin);
    const max = commMax === '' ? 255 : Number(commMax);
    if (Number.isNaN(min) || Number.isNaN(max)) {
      return null;
    }
    const clampedMin = Math.max(0, Math.min(255, min));
    const clampedMax = Math.max(0, Math.min(255, max));
    return clampedMin <= clampedMax
      ? ([clampedMin, clampedMax] as [number, number])
      : ([clampedMax, clampedMin] as [number, number]);
  }, [commMin, commMax]);

  const handleRangeCommit = () => {
    if (!commMin && !commMax) {
      void setFilters({ communicationRange: null });
      return;
    }
    const range = parsedCommunicationRange;
    if (!range) {
      return;
    }
    void setFilters({ communicationRange: range });
  };

  const handleCreateSubmit = async () => {
    setSubmitting(true);
    try {
      await createProject({
        ...createForm,
        code: createForm.code.trim(),
        region: createForm.region?.trim() || undefined,
        location: {
          text: createForm.location?.text?.trim() || undefined,
          lat: createForm.location?.lat,
          lng: createForm.location?.lng
        },
        description: createForm.description?.trim() || undefined
      });
      setCreateOpen(false);
      setCreateForm({
        name: '',
        code: '',
        region: '',
        stage: 'planning',
        location: { text: '', lat: undefined, lng: undefined },
        plannedOnlineAt: undefined,
        description: '',
        includeDefaultMembership: true
      });
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
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = useMemo(() => {
    if (!pagination.pageSize) return 1;
    const total = totals.total ?? 0;
    return Math.max(1, Math.ceil(total / pagination.pageSize));
  }, [totals.total, pagination.pageSize]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-white">项目管理</h1>
          <p className="mt-1 text-xs text-slate-400">
            浏览并维护通信 ID、施工阶段与团队协作信息。
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

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 flex-shrink-0 border-r border-slate-800 bg-slate-900/40 px-4 py-5">
          <div className="space-y-4 text-sm text-slate-200">
            <div>
              <label className="text-xs text-slate-400">搜索名称/通信 ID</label>
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="输入关键字"
                className="mt-1 w-full rounded border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs text-slate-400">状态</label>
                <select
                  value={filters.status}
                  onChange={(event) => void setFilters({ status: event.target.value as ProjectStatus | 'all' })}
                  className="mt-1 w-full rounded border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">施工阶段</label>
                <select
                  value={filters.stage}
                  onChange={(event) => void setFilters({ stage: event.target.value as ProjectStage | 'all' })}
                  className="mt-1 w-full rounded border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                >
                  {stageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">地区</label>
                <input
                  value={filters.region}
                  onChange={(event) => void setFilters({ region: event.target.value })}
                  placeholder="按地区过滤"
                  className="mt-1 w-full rounded border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">通信 ID 范围</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    value={commMin}
                    onChange={(event) => setCommMin(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                    onBlur={handleRangeCommit}
                    placeholder="最小值"
                    inputMode="numeric"
                    className="w-full rounded border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">—</span>
                  <input
                    value={commMax}
                    onChange={(event) => setCommMax(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                    onBlur={handleRangeCommit}
                    placeholder="最大值"
                    inputMode="numeric"
                    className="w-full rounded border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400">排序方式</label>
                <select
                  value={currentSortValue}
                  onChange={(event) => {
                    const value = event.target.value as typeof sortOptions[number]['value'];
                    const [field, order] = value.split('_') as ['name' | 'updatedAt', 'asc' | 'desc'];
                    void setSorting({ field, order });
                  }}
                  className="mt-1 w-full rounded border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
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
          </div>
        </aside>

        <section className="flex flex-1 flex-col overflow-hidden">
          <div className="grid grid-cols-1 gap-3 border-b border-slate-800 bg-slate-900/30 px-6 py-4 text-sm text-slate-200 md:grid-cols-3">
            <StatCard title="项目总数" value={totals.total} accent="text-brand-100" />
            <StatCard title="活跃项目" value={totals.active} accent="text-emerald-200" />
            <StatCard title="归档/删除" value={(totals.archived ?? 0) + (totals.deleted ?? 0)} accent="text-amber-200" />
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-auto px-6 py-4">
              <table className="min-w-full table-fixed border-separate border-spacing-y-2 text-sm text-slate-200">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">通信 ID</th>
                    <th className="px-4 py-2">项目名称</th>
                    <th className="px-4 py-2">地区</th>
                    <th className="px-4 py-2">阶段</th>
                    <th className="px-4 py-2 text-right">摄像头</th>
                    <th className="px-4 py-2 text-right">布局数</th>
                    <th className="px-4 py-2">最近修改</th>
                    <th className="px-4 py-2">状态</th>
                    <th className="px-4 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-xs text-slate-500">
                        正在加载项目数据...
                      </td>
                    </tr>
                  )}
                  {!isLoading && data.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-xs text-slate-500">
                        未找到符合条件的项目，可调整筛选条件。
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    data.map((project) => (
                      <ProjectRow
                        key={project.id}
                        project={project}
                        onClick={() => void setActiveProject(project.id)}
                        onArchive={() => void updateProject(project.id, { status: 'archived' })}
                        onRestore={() =>
                          project.status === 'deleted'
                            ? void restoreProject(project.id)
                            : void updateProject(project.id, { status: 'active' })
                        }
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
        </section>
      </div>

      <ProjectDetailDrawer
        open={Boolean(activeProjectId)}
        onClose={() => void setActiveProject(null)}
        project={activeProject}
        isLoading={isDetailLoading}
        onArchive={() => {
          if (!activeProject) return;
          void updateProject(activeProject.id, { status: 'archived' });
        }}
        onRestore={() => {
          if (!activeProject) return;
          if (activeProject.status === 'deleted') {
            void restoreProject(activeProject.id);
          } else {
            void updateProject(activeProject.id, { status: 'active' });
          }
        }}
        onDelete={() => {
          if (!activeProject) return;
          setDeleteTarget(
            data.find((item) => item.id === activeProject.id) ?? {
              ...activeProject,
              defaultLayoutId: activeProject.defaultLayoutId ?? null
            }
          );
          setDeleteConfirm('');
          setDeleteOptions({
            archiveLayouts: true,
            keepDeviceMappings: true,
            reason: ''
          });
        }}
      />

      <CreateProjectDrawer
        open={isCreateOpen}
        isSubmitting={isSubmitting}
        onClose={() => setCreateOpen(false)}
        form={createForm}
        onChange={setCreateForm}
        onSubmit={handleCreateSubmit}
      />

      <DeleteProjectDialog
        open={Boolean(deleteTarget)}
        project={deleteTarget}
        confirmValue={deleteConfirm}
        options={deleteOptions}
        isSubmitting={isSubmitting}
        onConfirmChange={setDeleteConfirm}
        onOptionsChange={setDeleteOptions}
        onClose={() => setDeleteTarget(null)}
        onSubmit={handleDeleteSubmit}
      />
    </div>
  );
};

const StatCard = ({ title, value, accent }: { title: string; value: number; accent: string }) => (
  <div className="rounded border border-slate-800/70 bg-slate-900/50 px-4 py-3">
    <div className="text-xs text-slate-400">{title}</div>
    <div className={`mt-2 text-xl font-semibold ${accent}`}>{value ?? 0}</div>
  </div>
);

const ProjectRow = ({
  project,
  onClick,
  onArchive,
  onRestore,
  onDelete
}: {
  project: ProjectListItem;
  onClick: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) => {
  const layoutTarget = project.defaultLayoutId
    ? `/projects/${project.id}/layouts/${project.defaultLayoutId}`
    : `/projects/${project.id}`;

  const statusTone = project.status === 'active'
    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
    : project.status === 'archived'
    ? 'bg-slate-600/30 text-slate-200 border border-slate-500/40'
    : 'bg-rose-500/20 text-rose-200 border border-rose-500/40';

  return (
    <tr
      className="cursor-pointer rounded border border-slate-800/70 bg-slate-900/40 transition hover:border-brand-400/70"
      onClick={onClick}
    >
      <td className="px-4 py-3 text-xs text-slate-300">{project.code}</td>
      <td className="px-4 py-3 text-sm font-medium text-slate-100">{project.name}</td>
      <td className="px-4 py-3 text-xs text-slate-300">{project.region ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-slate-300">{stageLabel(project.stage)}</td>
      <td className="px-4 py-3 text-right text-xs text-slate-300">{project.deviceCount ?? 0}</td>
      <td className="px-4 py-3 text-right text-xs text-slate-300">{project.layoutCount ?? 0}</td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {project.updatedAt ? new Date(project.updatedAt).toLocaleString() : '—'}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${statusTone}`}>
          {statusLabel(project.status)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <Menu as="div" className="relative inline-block text-left" onClick={(event) => event.stopPropagation()}>
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
            <Menu.Items className="absolute right-0 mt-2 w-40 origin-top-right rounded-md border border-slate-800 bg-slate-900/95 shadow-lg focus:outline-none">
              <Menu.Item>
                {({ active }) => (
                  <Link
                    to={layoutTarget}
                    className={`block px-3 py-2 text-xs ${active ? 'bg-slate-800 text-white' : 'text-slate-200'}`}
                  >
                    打开布局工作台
                  </Link>
                )}
              </Menu.Item>
              {project.status === 'active' && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={onArchive}
                      className={`block w-full px-3 py-2 text-left text-xs ${active ? 'bg-slate-800 text-white' : 'text-slate-200'}`}
                    >
                      归档项目
                    </button>
                  )}
                </Menu.Item>
              )}
              {(project.status === 'archived' || project.status === 'deleted') && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={onRestore}
                      className={`block w-full px-3 py-2 text-left text-xs ${active ? 'bg-slate-800 text-white' : 'text-slate-200'}`}
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
                      className={`block w-full px-3 py-2 text-left text-xs ${active ? 'bg-rose-500/20 text-rose-200' : 'text-rose-300'}`}
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

const statusLabel = (status: ProjectStatus) => {
  switch (status) {
    case 'active':
      return '活跃';
    case 'archived':
      return '归档';
    case 'deleted':
      return '已删除';
    default:
      return status;
  }
};

const stageLabel = (stage: ProjectStage) => {
  switch (stage) {
    case 'planning':
      return '规划中';
    case 'construction':
      return '施工中';
    case 'completed':
      return '已完成';
    case 'archived':
      return '已归档';
    default:
      return stage;
  }
};

interface ProjectDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  project: ProjectDetail | null;
  isLoading: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

const ProjectDetailDrawer = ({
  open,
  onClose,
  project,
  isLoading,
  onArchive,
  onRestore,
  onDelete
}: ProjectDetailDrawerProps) => {
  const statusTone = project?.status === 'active'
    ? 'text-emerald-300'
    : project?.status === 'archived'
    ? 'text-slate-200'
    : 'text-rose-300';

  const layoutLink = project?.defaultLayoutId
    ? `/projects/${project.id}/layouts/${project.defaultLayoutId}`
    : project
    ? `/projects/${project.id}`
    : '#';
  const canOpenLayout = Boolean(project?.defaultLayoutId);

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
            <Dialog.Panel className="flex h-full w-full max-w-lg flex-col border-l border-slate-800 bg-slate-950/95 p-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <Dialog.Title className="text-lg font-semibold text-white">
                    {project?.name ?? '项目详情'}
                  </Dialog.Title>
                  {project && (
                    <p className="mt-1 text-xs text-slate-400">
                      通信 ID：{project.code} · 状态：
                      <span className={statusTone}>{statusLabel(project.status)}</span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded border border-slate-800/80 bg-slate-900/80 px-2 py-1 text-xs text-slate-300 transition hover:border-brand-400/80 hover:text-white"
                >
                  关闭
                </button>
              </div>

              <div className="mt-6 flex-1 overflow-y-auto pr-2 text-sm text-slate-200">
                {isLoading && (
                  <div className="rounded border border-slate-800/80 bg-slate-900/70 px-3 py-3 text-xs text-slate-400">
                    正在加载项目详情...
                  </div>
                )}
                {!isLoading && project && (
                  <div className="space-y-6">
                    <section className="space-y-2">
                      <h3 className="text-xs uppercase tracking-wide text-slate-500">基础信息</h3>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <InfoRow label="通信 ID" value={project.code.toString()} />
                        <InfoRow label="地区" value={project.region ?? '—'} />
                        <InfoRow label="施工阶段" value={stageLabel(project.stage)} />
                        <InfoRow label="计划上线" value={formatDate(project.plannedOnlineAt)} />
                        <InfoRow label="最近修改" value={formatDate(project.updatedAt)} />
                        <InfoRow label="创建时间" value={formatDate(project.createdAt)} />
                      </div>
                      <div>
                        <InfoRow
                          label="备注"
                          value={project.description && project.description.trim() ? project.description : '无'}
                        />
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs uppercase tracking-wide text-slate-500">统计</h3>
                      <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs text-slate-300">
                        <div className="rounded border border-slate-800/70 bg-slate-900/70 px-3 py-3">
                          <div className="text-[10px] uppercase text-slate-500">布局数</div>
                          <div className="mt-1 text-lg font-semibold text-emerald-200">
                            {project.layoutCount ?? 0}
                          </div>
                        </div>
                        <div className="rounded border border-slate-800/70 bg-slate-900/70 px-3 py-3">
                          <div className="text-[10px] uppercase text-slate-500">摄像头</div>
                          <div className="mt-1 text-lg font-semibold text-amber-200">
                            {project.deviceCount ?? 0}
                          </div>
                        </div>
                        <div className="rounded border border-slate-800/70 bg-slate-900/70 px-3 py-3">
                          <div className="text-[10px] uppercase text-slate-500">状态</div>
                          <div className="mt-1 text-lg font-semibold">{statusLabel(project.status)}</div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs uppercase tracking-wide text-slate-500">最近布局</h3>
                        <Link
                          to={`/projects/${project.id}`}
                          className="text-xs text-brand-200 underline-offset-2 hover:text-brand-100 hover:underline"
                        >
                          查看全部布局
                        </Link>
                      </div>
                      <div className="mt-2 space-y-2">
                        {project.recentLayouts.length === 0 && (
                          <div className="rounded border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">
                            尚无布局记录
                          </div>
                        )}
                        {project.recentLayouts.map((layout) => (
                          <Link
                            key={layout.id}
                            to={`/projects/${project.id}/layouts/${layout.id}`}
                            className="flex items-center justify-between rounded border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 transition hover:border-brand-400/80 hover:text-white"
                          >
                            <span className="truncate">{layout.name}</span>
                            <span className="text-slate-400">{formatDate(layout.updatedAt)}</span>
                          </Link>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs uppercase tracking-wide text-slate-500">项目成员</h3>
                      <div className="mt-2 space-y-2">
                        {project.members.length === 0 && (
                          <div className="rounded border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">
                            尚未添加成员
                          </div>
                        )}
                        {project.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between rounded border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-xs text-slate-200"
                          >
                            <div>
                              <div className="font-medium text-slate-100">
                                {member.user?.name ?? '未知成员'}
                              </div>
                              <div className="text-slate-500">{member.user?.email ?? '无邮箱'}</div>
                            </div>
                            <span className="rounded border border-slate-700/70 px-2 py-1 text-[11px] text-slate-300">
                              {roleLabel(member.role)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <Link
                  to={layoutLink}
                  onClick={project ? onClose : undefined}
                  className={`rounded border px-4 py-2 text-xs transition hover:border-brand-400/80 hover:text-white ${
                    canOpenLayout
                      ? 'border-slate-700/70 text-slate-300'
                      : 'cursor-not-allowed border-slate-800/50 text-slate-600 hover:border-slate-800/50 hover:text-slate-600'
                  }`}
                >
                  打开布局工作台
                </Link>
                {project?.status !== 'deleted' && (
                  <button
                    type="button"
                    onClick={onArchive}
                    className="rounded border border-amber-400/60 px-4 py-2 text-xs text-amber-200 transition hover:border-amber-300 hover:text-amber-50"
                  >
                    归档
                  </button>
                )}
                {project && project.status !== 'active' && (
                  <button
                    type="button"
                    onClick={onRestore}
                    className="rounded border border-emerald-400/60 px-4 py-2 text-xs text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-50"
                  >
                    恢复
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded border border-rose-500/70 bg-rose-500/20 px-4 py-2 text-xs text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/30"
                >
                  删除
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

const roleLabel = (role: string) => {
  switch (role) {
    case 'owner':
      return '负责人';
    case 'maintainer':
      return '维护者';
    case 'viewer':
      return '查看者';
    default:
      return role;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded border border-slate-800/70 bg-slate-900/70 px-3 py-2">
    <div className="text-[11px] uppercase text-slate-500">{label}</div>
    <div className="mt-1 text-sm text-slate-100">{value}</div>
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
                填写通信 ID 与项目信息，后续可在布局页中继续配置。
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
                <FormField label="通信 ID" hint="0-255 的唯一整数" required>
                  <input
                    value={form.code}
                    onChange={(event) => {
                      const value = event.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                      onChange({ ...form, code: value });
                    }}
                    required
                    inputMode="numeric"
                    pattern="^([0-9]{1,3})$"
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
                      .filter((option) => option.value !== 'all')
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
                    onChange={(event) => onChange({ ...form, plannedOnlineAt: event.target.value || undefined })}
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
                  将创建者自动加入项目成员
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
  project: ProjectListItem | ProjectDetail | null;
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
}: DeleteProjectDialogProps) => (
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
              删除操作会将项目标记为“已删除”，可在 30 天内恢复。要继续，请输入项目名称确认。
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
