import { useCanvasStore } from '../../stores/canvasStore';

const FloatingPropertyPanel = () => {
  const { hoveredElement } = useCanvasStore((state) => ({
    hoveredElement:
      state.hoveredElementId !== null
        ? state.elements.find((element) => element.id === state.hoveredElementId) ?? null
        : null
  }));

  if (!hoveredElement) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute right-6 top-6 z-20 w-72 max-w-full">
      <div className="pointer-events-auto space-y-3 rounded border border-slate-800/80 bg-slate-950/90 px-4 py-4 text-sm text-slate-200 backdrop-blur-md">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">设备名称</span>
          <span className="truncate text-lg font-semibold text-slate-100">{hoveredElement.name}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">IP 地址</span>
          <span className="text-base text-slate-200">{hoveredElement.metadata?.ip ?? '待分配 IP'}</span>
        </div>
      </div>
    </div>
  );
};

export default FloatingPropertyPanel;
