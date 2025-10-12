import { BlueprintDrawer } from './BlueprintDrawer';
import { useUIStore } from '../../stores/uiStore';
import { useCanvasStore } from '../../stores/canvasStore';

export const BlueprintManager = () => {
  const blueprint = useCanvasStore((state) => state.blueprint);
  const blueprintMode = useUIStore((state) => state.blueprintMode);

  const statusText = (() => {
    if (blueprintMode === 'editing') {
      return '蓝图编辑中';
    }
    if (blueprint) {
      return '蓝图已锁定';
    }
    return null;
  })();

  const panelClasses =
    blueprintMode === 'editing'
      ? 'border-amber-500/70 bg-amber-500/15 text-amber-100'
      : 'border-slate-700/80 bg-slate-900/90 text-slate-200';

  return (
    <>
      {statusText && (
        <div className="pointer-events-none absolute right-6 top-6 z-30 flex flex-col items-end gap-2">
          <div
            className={`pointer-events-auto flex items-center gap-3 rounded border px-4 py-2 text-xs font-medium shadow-lg shadow-slate-900/40 ${panelClasses}`}
          >
            <span>{statusText}</span>
          </div>
        </div>
      )}
      <BlueprintDrawer />
    </>
  );
};
