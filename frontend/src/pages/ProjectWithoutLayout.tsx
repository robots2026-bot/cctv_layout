import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { apiClient } from '../utils/apiClient';
import { ProjectDetail } from '../types/projects';

const ProjectWithoutLayout = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProjectStore((state) =>
    state.projects.find((item) => item.id === projectId)
  );
  const navigate = useNavigate();
  const fetchProjects = useProjectStore((state) => state.fetchProjects);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setProcessing] = useState(true);

  const projectName = useMemo(() => project?.name ?? '未命名项目', [project]);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    setProcessing(true);
    setError(null);

    const ensureLayout = async () => {
      try {
        const detailResponse = await apiClient.get<ProjectDetail>(`/projects/${projectId}`, {
          signal: controller.signal
        });
        const detail = detailResponse.data;
        let layoutId = detail.defaultLayoutId ?? null;

        if (!layoutId) {
          const layoutName = `${detail.name ?? '默认'}布局`;
          const createResponse = await apiClient.post<{ id: string }>(
            '/layouts',
            { projectId, name: layoutName },
            { signal: controller.signal }
          );
          layoutId = createResponse.data.id;
          await fetchProjects({ silent: true });
        }

        if (layoutId) {
          navigate(`/projects/${projectId}/layouts/${layoutId}`, { replace: true });
          return;
        }

        setError('项目尚未创建布局，请前往项目管理手动创建。');
      } catch (exception) {
        if (!controller.signal.aborted) {
          console.error('自动创建布局失败', exception);
          setError('自动创建布局失败，请稍后重试或前往项目管理手动创建。');
        }
      } finally {
        if (!controller.signal.aborted) {
          setProcessing(false);
        }
      }
    };

    void ensureLayout();

    return () => controller.abort();
  }, [projectId, navigate, fetchProjects]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-sm text-slate-300">
      <div className="text-base font-medium text-slate-100">{projectName}</div>
      {isProcessing && <div className="text-xs text-slate-400">正在为项目创建默认布局…</div>}
      {!isProcessing && error && <div className="text-xs text-rose-300">{error}</div>}
      {!isProcessing && !error && (
        <div className="text-xs text-slate-400">即将跳转至布局工作台…</div>
      )}
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
