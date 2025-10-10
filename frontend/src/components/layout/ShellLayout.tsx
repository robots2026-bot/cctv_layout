import { PropsWithChildren, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { useUIStore } from '../../stores/uiStore';
import { useProjectStore } from '../../stores/projectStore';

const ShellLayout = ({ children }: PropsWithChildren) => {
  const connectionState = useRealtimeStore((state) => state.connectionState);
  const notifications = useUIStore((state) => state.notifications);
  const { projects, fetchProjects, isLoading } = useProjectStore((state) => ({
    projects: state.projects,
    fetchProjects: state.fetchProjects,
    isLoading: state.isLoading
  }));
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && projects.length === 0) {
      void fetchProjects();
    }
  }, [fetchProjects, isLoading, projects.length]);

  return (
    <div className="flex h-screen w-full flex-col bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-4">
        <Link to="/projects" className="text-xl font-semibold text-white">
          CCTV 布局平台
        </Link>
        <div className="flex items-center gap-4 text-sm text-slate-300">
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
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">项目</h2>
            {isLoading && <span className="text-xs text-slate-500">加载中...</span>}
          </div>
          <div className="mt-3 space-y-1 overflow-y-auto pr-1 text-sm text-slate-300">
            {projects.length === 0 && !isLoading && (
              <div className="rounded border border-dashed border-slate-700/60 bg-slate-900/60 p-3 text-xs text-slate-500">
                尚未创建项目
              </div>
            )}
            {projects.map((project) => {
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
        </aside>
        <div className="relative flex-1 overflow-hidden">{children}</div>
        <aside className="w-80 border-l border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-slate-200">通知</h2>
          <ul className="mt-3 space-y-2 text-xs text-slate-400">
            {notifications.length === 0 && <li>暂无通知</li>}
            {notifications.map((notification) => (
              <li key={notification.id} className="rounded border border-slate-800/80 bg-slate-900/60 p-2">
                <div className="font-medium text-slate-200">{notification.title}</div>
                <div>{notification.message}</div>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
};

export default ShellLayout;
