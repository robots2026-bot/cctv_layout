import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { DevicePalette } from '../components/sidebar/DevicePalette';
import { useLayoutStore } from '../stores/layoutStore';
import FloatingPropertyPanel from '../components/panels/FloatingPropertyPanel';
import { useCanvasStore } from '../stores/canvasStore';
import { useUIStore } from '../stores/uiStore';

const LayoutWorkbench = () => {
  const { projectId, layoutId } = useParams();
  const { loadLayout, isLoading } = useLayoutStore((state) => ({
    loadLayout: state.loadLayout,
    isLoading: state.isLoading
  }));
  const resetCanvas = useCanvasStore((state) => state.resetCanvas);
  const { isDevicePanelCollapsed, toggleDevicePanel } = useUIStore((state) => ({
    isDevicePanelCollapsed: state.isDevicePanelCollapsed,
    toggleDevicePanel: state.toggleDevicePanel
  }));

  useEffect(() => {
    if (layoutId) {
      loadLayout(layoutId);
    }
    return () => resetCanvas();
  }, [layoutId, loadLayout, resetCanvas]);

  return (
    <div className="relative flex h-full w-full">
      <div className="relative flex flex-1 flex-col bg-slate-950">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">布局加载中...</div>
        ) : (
          <CanvasStage />
        )}
        <FloatingPropertyPanel />
      </div>
      {!isDevicePanelCollapsed && (
        <div className="relative flex w-72 flex-col border-l border-slate-800 bg-slate-900/40">
          <button
            type="button"
            onClick={toggleDevicePanel}
            aria-label="收起设备侧栏"
            className="absolute left-0 top-4 z-20 -translate-x-1/2 rounded border border-slate-800/80 bg-slate-900/80 px-2 py-1 text-xs text-slate-400 shadow transition hover:border-brand-400/80 hover:text-white"
          >
            收起
          </button>
          <DevicePalette projectId={projectId ?? ''} />
        </div>
      )}
      {isDevicePanelCollapsed && (
        <button
          type="button"
          onClick={toggleDevicePanel}
          aria-label="展开设备侧栏"
          className="absolute right-4 top-6 z-30 rounded border border-slate-800/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 shadow transition hover:border-brand-400/80 hover:text-white"
        >
          展开设备
        </button>
      )}
    </div>
  );
};

export default LayoutWorkbench;
