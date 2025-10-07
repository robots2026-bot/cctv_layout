import { useCanvasStore } from '../../stores/canvasStore';
import { useLayoutStore } from '../../stores/layoutStore';

export const PropertyPanel = () => {
  const selectedElement = useCanvasStore((state) => state.selectedElement);
  const background = useLayoutStore((state) => state.layout?.background);
  const updateElement = useCanvasStore((state) => state.updateElementMetadata);
  const updateBackgroundOpacity = useLayoutStore((state) => state.updateBackgroundOpacity);

  if (!selectedElement) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">属性</h2>
        </div>
        <div className="flex-1 p-4 text-xs text-slate-500">选择设备以编辑属性</div>
        {background && (
          <div className="border-t border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-400">背景透明度</p>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={background.opacity}
              onChange={(event) => updateBackgroundOpacity(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">设备属性</h2>
        <p className="mt-1 text-xs text-slate-500">ID: {selectedElement.id}</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs text-slate-300">
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">设备名称</span>
          <input
            className="rounded border border-slate-800 bg-slate-900/60 p-2 text-slate-100"
            value={selectedElement.name}
            onChange={(event) => updateElement(selectedElement.id, { name: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">IP 地址</span>
          <input
            className="rounded border border-slate-800 bg-slate-900/60 p-2 text-slate-100"
            value={selectedElement.metadata?.ip ?? ''}
            onChange={(event) => updateElement(selectedElement.id, { metadata: { ip: event.target.value } })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">设备类型</span>
          <input
            className="rounded border border-slate-800 bg-slate-900/60 p-2 text-slate-100"
            value={selectedElement.type}
            onChange={(event) => updateElement(selectedElement.id, { type: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
};
