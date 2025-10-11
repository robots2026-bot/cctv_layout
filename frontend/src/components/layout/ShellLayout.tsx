import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';

const ShellLayout = ({ children }: PropsWithChildren) => {
  const connectionState = useRealtimeStore((state) => state.connectionState);
  const notificationCount = useUIStore((state) => state.notifications.length);
  const { isProjectSidebarCollapsed, toggleProjectSidebar } = useUIStore((state) => ({
    isProjectSidebarCollapsed: state.isProjectSidebarCollapsed,
    toggleProjectSidebar: state.toggleProjectSidebar
  }));
  const { projects, fetchProjects, isLoading } = useProjectStore((state) => ({
    projects: state.projects,
    fetchProjects: state.fetchProjects,
    isLoading: state.isLoading
  }));
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isLoading && projects.length === 0) {
      void fetchProjects();
    }
  }, [fetchProjects, isLoading, projects.length]);

  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) {
      return projects;
    }
    const term = searchTerm.toLowerCase();
    return projects.filter((project) => {
      const nameMatch = project.name.toLowerCase().includes(term);
      const locationMatch = project.location?.toLowerCase().includes(term) ?? false;
      return nameMatch || locationMatch;
    });
  }, [projects, searchTerm]);

  return (
    <div className="flex h-screen w-full flex-col bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-4">
        <Link to="/" className="text-xl font-semibold text-white">
          CCTV 布局平台
        </Link>
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Link
            to="/projects/manage"
            className="rounded border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-brand-400/80 hover:text-white"
          >
            项目管理
          </Link>
            <span>
              实时连接：
              <span
                className={
                  connectionState === 'connected'
                    ? 'text-emerald-400'
                    : connectionState === 'connecting'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }
              >
                {connectionState}
              </span>
            </span>
          <span className="rounded border border-slate-800 bg-slate-900/80 px-2 py-1 text-xs text-slate-400">
            通知 {notificationCount}
          </span>
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <aside
          className={`flex flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900/40 transition-all duration-200 ${
            isProjectSidebarCollapsed ? 'w-14' : 'w-72'
          }`}
        >
          <div className="flex items-center justify-between px-3 py-3">
            {!isProjectSidebarCollapsed && (
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-200">项目</h2>
                {isLoading && <span className="text-xs text-slate-500">加载中...</span>}
              </div>
            )}
            <button
              type="button"
              onClick={toggleProjectSidebar}
              aria-label={isProjectSidebarCollapsed ? '展开项目侧栏' : '收起项目侧栏'}
              className="rounded border border-slate-800/80 bg-slate-900/70 px-2 py-1 text-xs text-slate-400 transition hover:border-brand-400/80 hover:text-white"
            >
              {isProjectSidebarCollapsed ? '>' : '<'}
            </button>
          </div>
          {!isProjectSidebarCollapsed && (
            <>
              <div className="px-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="快速搜索项目..."
                  className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                />
              </div>
              <div className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pr-1 text-sm text-slate-300">
                {projects.length === 0 && !isLoading && (
                  <div className="rounded border border-dashed border-slate-700/60 bg-slate-900/60 p-3 text-xs text-slate-500">
                    尚未创建项目
                  </div>
                )}
                {projects.length > 0 && filteredProjects.length === 0 && (
                  <div className="rounded border border-dashed border-slate-700/60 bg-slate-900/60 p-3 text-xs text-slate-500">
                    无匹配的项目
                  </div>
                )}
                {filteredProjects.map((project) => {
                  const target = project.defaultLayoutId
                    ? `/projects/${project.id}/layouts/${project.defaultLayoutId}`
                    : `/projects/${project.id}`;
                  const isActive = location.pathname.startsWith(`/projects/${project.id}`);
                  return (
                    <Link
                      key={project.id}
                      to={target}
                      className={`block rounded px-3 py-2 transition ${
                        isActive ? 'bg-slate-800/80 text-white' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="text-sm font-medium leading-5">{project.name}</div>
                      <div className="text-xs text-slate-400">{project.location ?? '未设置地点'}</div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </aside>
        <div className="relative flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
};

export default ShellLayout;
