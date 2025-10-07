import { useParams } from 'react-router-dom';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { DevicePalette } from '../components/sidebar/DevicePalette';
import { PropertyPanel } from '../components/sidebar/PropertyPanel';
import { useCanvasStore } from '../stores/canvasStore';
import { useEffect } from 'react';
import { useLayoutStore } from '../stores/layoutStore';

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
      <div className="flex w-72 flex-col border-r border-slate-800 bg-slate-900/40">
        <DevicePalette projectId={projectId ?? ''} />
      </div>
      <div className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">布局加载中...</div>
        ) : (
          <CanvasStage />
        )}
      </div>
      <div className="flex w-80 flex-col border-l border-slate-800 bg-slate-900/30">
        <PropertyPanel />
      </div>
    </div>
  );
};

export default LayoutWorkbench;
