import { Link, useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useProjectStore } from '../stores/projectStore';

const ProjectWithoutLayout = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProjectStore((state) =>
    state.projects.find((item) => item.id === projectId)
  );

  const projectName = useMemo(() => project?.name ?? '未命名项目', [project]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-sm text-slate-300">
      <div className="text-base font-medium text-slate-100">{projectName}</div>
      <div>当前项目尚未配置默认布局，请选择现有布局或创建新的布局。</div>
      <Link
        to="/projects/manage"
        className="rounded border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-brand-400/80 hover:text-white"
      >
        前往项目管理
      </Link>
    </div>
  );
};

export default ProjectWithoutLayout;
