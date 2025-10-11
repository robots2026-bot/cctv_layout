import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { DevicePalette } from '../components/sidebar/DevicePalette';
import { useLayoutStore } from '../stores/layoutStore';
import FloatingPropertyPanel from '../components/panels/FloatingPropertyPanel';
import { useCanvasStore } from '../stores/canvasStore';

const LayoutWorkbench = () => {
  const { projectId, layoutId } = useParams();
  const { loadLayout, isLoading } = useLayoutStore((state) => ({
    loadLayout: state.loadLayout,
    isLoading: state.isLoading
  }));
  const resetCanvas = useCanvasStore((state) => state.resetCanvas);

  useEffect(() => {
    if (layoutId) {
      loadLayout(layoutId);
    }
    return () => resetCanvas();
  }, [layoutId, loadLayout, resetCanvas]);

  return (
    <div className="flex h-full w-full">
      <div className="relative flex flex-1 flex-col bg-slate-950">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">布局加载中...</div>
        ) : (
          <CanvasStage />
        )}
        <FloatingPropertyPanel />
      </div>
      <div className="flex w-96 flex-col border-l border-slate-800 bg-slate-900/40">
        <DevicePalette projectId={projectId ?? ''} />
      </div>
    </div>
  );
};

export default LayoutWorkbench;
