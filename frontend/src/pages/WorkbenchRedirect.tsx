import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';

const WorkbenchRedirect = () => {
  const navigate = useNavigate();
  const { projects, isLoading, fetchProjects } = useProjectStore((state) => ({
    projects: state.projects,
    isLoading: state.isLoading,
    fetchProjects: state.fetchProjects
  }));

  useEffect(() => {
    if (!isLoading && projects.length === 0) {
      void fetchProjects();
    }
  }, [fetchProjects, isLoading, projects.length]);

  const defaultTarget = useMemo(() => {
    return projects.find((project) => project.defaultLayoutId);
  }, [projects]);

  useEffect(() => {
    if (!isLoading && defaultTarget?.defaultLayoutId) {
      navigate(`/projects/${defaultTarget.id}/layouts/${defaultTarget.defaultLayoutId}`, { replace: true });
    }
  }, [defaultTarget, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        加载项目信息...
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-sm text-slate-300">
        <div>尚未创建任何项目。</div>
        <Link
          to="/projects/manage"
          className="rounded border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-brand-400/80 hover:text-white"
        >
          前往项目管理
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-sm text-slate-300">
      <div>当前项目尚未设置默认布局，请在项目管理中创建布局或设为默认。</div>
      <Link
        to="/projects/manage"
        className="rounded border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-brand-400/80 hover:text-white"
      >
        前往项目管理
      </Link>
    </div>
  );
};

export default WorkbenchRedirect;
