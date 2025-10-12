import { MagnifyingGlassPlusIcon } from '@heroicons/react/24/solid';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasMode } from '../../stores/canvasStore';

export const CanvasLinkingControls = () => {
  const { mode, setMode, cancelLinking, selectedConnectionId, removeConnection, viewportScale } = useCanvasStore(
    (state) => ({
      mode: state.mode,
      setMode: state.setMode,
      cancelLinking: state.cancelLinking,
      selectedConnectionId: state.selectedConnectionId,
      removeConnection: state.removeConnection,
      viewportScale: state.viewport.scale
    })
  );
  const formattedScale = viewportScale.toFixed(viewportScale >= 1 ? 1 : 2);

  const handleModeChange = (nextMode: CanvasMode) => {
    if (mode === 'linking' && nextMode !== 'linking') {
      cancelLinking();
    }
    if (nextMode === 'linking') {
      cancelLinking();
    }
    setMode(nextMode);
  };

  const handleDeleteConnection = () => {
    if (selectedConnectionId) {
      removeConnection(selectedConnectionId);
    }
  };

  const resolveButtonClasses = (targetMode: CanvasMode, activeClasses: string) =>
    `rounded px-3 py-1 font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
      mode === targetMode ? activeClasses : 'bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
    }`;

  return (
    <div className="pointer-events-none absolute left-6 top-6 z-30 flex flex-col gap-2">
      <div className="pointer-events-auto flex items-center gap-3">
        <div className="flex flex-wrap items-center gap-3 rounded border border-slate-700/80 bg-slate-900/90 px-4 py-2 text-xs text-slate-200/90 shadow-lg shadow-slate-900/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleModeChange('view')}
              className={resolveButtonClasses('view', 'bg-slate-500/90 text-white')}
            >
              观看
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('layout')}
              className={resolveButtonClasses('layout', 'bg-sky-500/90 text-white')}
            >
              布局
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('linking')}
              className={resolveButtonClasses('linking', 'bg-rose-500/90 text-white')}
            >
              连线
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('blueprint')}
              className={resolveButtonClasses('blueprint', 'bg-indigo-500/90 text-white')}
            >
              蓝图
            </button>
          </div>
          {mode === 'linking' && selectedConnectionId && (
            <button
              type="button"
              onClick={handleDeleteConnection}
              className="rounded border border-slate-600/70 px-3 py-1 text-xs font-medium text-slate-100 transition hover:bg-slate-800/80"
            >
              删除选中连线
            </button>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded border border-slate-700/80 bg-slate-800/70 px-2 py-1 text-[11px] text-slate-200 shadow-lg shadow-slate-900/40">
          <MagnifyingGlassPlusIcon className="h-4 w-4 text-slate-300" />
          <span>{formattedScale}×</span>
        </div>
      </div>
    </div>
  );
};
