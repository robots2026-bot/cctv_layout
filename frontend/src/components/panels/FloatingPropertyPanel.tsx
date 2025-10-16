import { useCanvasStore } from '../../stores/canvasStore';
import { getDeviceTypeVisual, getStatusVisual } from '../../utils/deviceVisual';

const FloatingPropertyPanel = () => {
  const { hoveredElement, linkingActive } = useCanvasStore((state) => ({
    hoveredElement:
      state.hoveredElementId !== null
        ? state.elements.find((element) => element.id === state.hoveredElementId) ?? null
        : null,
    linkingActive: state.linking.active
  }));

  if (!hoveredElement || linkingActive) {
    return null;
  }

  const typeVisual = getDeviceTypeVisual(hoveredElement.type);
  const statusVisual = getStatusVisual(hoveredElement.metadata?.status as string | undefined);
  const model = (hoveredElement.metadata?.model as string | undefined)?.trim() ?? '';
  const ip = hoveredElement.metadata?.ip ?? '待分配 IP';

  return (
    <div className="pointer-events-none absolute right-6 top-6 z-20 w-72 max-w-full">
      <div className="pointer-events-auto space-y-3 rounded border border-slate-800/80 bg-slate-950/90 px-4 py-4 text-sm text-slate-200 backdrop-blur-md">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">设备名称</span>
          <span className="truncate text-lg font-semibold text-slate-100">{hoveredElement.name}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">设备类型</span>
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: typeVisual.accent,
              color: typeVisual.text,
              backgroundColor: typeVisual.background
            }}
          >
            {typeVisual.label}
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase"
              style={{ backgroundColor: statusVisual.panelBg, color: statusVisual.textColor }}
            >
              {statusVisual.label}
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">设备型号</span>
          <span className="text-base text-slate-200">{model || '—'}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">IP 地址</span>
          <span className="text-base text-slate-200">{ip}</span>
        </div>
      </div>
    </div>
  );
};

export default FloatingPropertyPanel;
