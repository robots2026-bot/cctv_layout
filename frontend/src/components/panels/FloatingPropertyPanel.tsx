import { useMemo, useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useLayoutStore } from '../../stores/layoutStore';

const FloatingPropertyPanel = () => {
  const selectedElement = useCanvasStore((state) => state.selectedElement);
  const updateElement = useCanvasStore((state) => state.updateElementMetadata);
  const updateBackgroundOpacity = useLayoutStore((state) => state.updateBackgroundOpacity);
  const background = useLayoutStore((state) => state.layout?.background);
  const [collapsed, setCollapsed] = useState(false);

  const headerLabel = useMemo(() => {
    if (selectedElement) {
      return `属性 · ${selectedElement.name}`;
    }
    return '画布属性';
  }, [selectedElement]);

  if (!selectedElement && !background) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute right-6 top-6 z-20 w-80 max-w-full">
      <div className="pointer-events-auto overflow-hidden rounded border border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-2">
          <h2 className="text-sm font-semibold text-slate-200">{headerLabel}</h2>
          <button
            type="button"
            onClick={() => setCollapsed((state) => !state)}
            className="rounded border border-slate-800/80 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-400 transition hover:border-brand-400/80 hover:text-slate-100"
          >
            {collapsed ? '展开' : '收起'}
          </button>
        </div>
        {!collapsed && (
          <div className="space-y-4 px-4 py-4 text-xs text-slate-300">
            {selectedElement ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-400">设备名称</span>
                  <input
                    className="rounded border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-brand-400/80 focus:outline-none"
                    value={selectedElement.name}
                    onChange={(event) =>
                      updateElement(selectedElement.id, { name: event.target.value })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-400">IP 地址</span>
                  <input
                    className="rounded border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-brand-400/80 focus:outline-none"
                    value={selectedElement.metadata?.ip ?? ''}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        metadata: { ip: event.target.value }
                      })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-400">类型标识</span>
                  <input
                    className="rounded border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-brand-400/80 focus:outline-none"
                    value={selectedElement.type}
                    onChange={(event) =>
                      updateElement(selectedElement.id, { type: event.target.value })
                    }
                  />
                </label>
              </>
            ) : (
              <div className="rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-slate-400">
                选择任意画布节点以编辑属性
              </div>
            )}
            {background && (
              <div className="space-y-2 rounded border border-slate-800/80 bg-slate-900/70 px-3 py-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  背景透明度
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={background.opacity}
                  onChange={(event) => updateBackgroundOpacity(Number(event.target.value))}
                  className="w-full"
                />
                <div className="text-right text-[11px] text-slate-400">
                  {Math.round(background.opacity * 100)}%
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingPropertyPanel;
