import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';

const ProjectOverview = () => {
  const { projects, fetchProjects, isLoading } = useProjectStore((state) => ({
    projects: state.projects,
    fetchProjects: state.fetchProjects,
    isLoading: state.isLoading
  }));

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">项目概览</h1>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {isLoading && <div className="text-sm text-slate-400">加载项目列表...</div>}
        {!isLoading && projects.length === 0 && <div className="text-sm text-slate-500">尚未创建项目</div>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const hasLayout = Boolean(project.defaultLayoutId);
            const linkTarget = hasLayout
              ? `/projects/${project.id}/layouts/${project.defaultLayoutId}`
              : `/projects/${project.id}`;
            return (
              <Link
                key={project.id}
                to={linkTarget}
                className="group rounded-lg border border-slate-800/70 bg-slate-900/60 p-4 transition hover:border-brand-400/80"
              >
              <div className="text-base font-medium text-slate-100">{project.name}</div>
              <div className="mt-2 text-xs text-slate-400">{project.location ?? '未设置地点'}</div>
              <div className="mt-4 text-xs text-slate-500">最近更新：{project.updatedAt ?? '未知'}</div>
              {!hasLayout && <div className="mt-2 text-xs text-amber-400">尚未创建默认布局</div>}
            </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProjectOverview;
