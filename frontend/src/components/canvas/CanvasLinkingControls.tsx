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
    if (mode !== 'linking') {
      return;
    }
    if (selectedConnectionId) {
      removeConnection(selectedConnectionId);
    }
  };

  const resolveButtonClasses = (targetMode: CanvasMode) =>
    `rounded-md border px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:ring-offset-2 focus:ring-offset-slate-900 ${
      mode === targetMode
        ? 'border-sky-400 bg-sky-500 text-white shadow-inner shadow-sky-900/50'
        : 'border-transparent bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
    }`;

  const showConnectionDeletion = mode === 'linking' && Boolean(selectedConnectionId);

  return (
    <div className="pointer-events-none absolute left-6 top-6 z-30 flex items-start gap-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-xs text-slate-200 shadow-md shadow-slate-900/40">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => handleModeChange('view')} className={resolveButtonClasses('view')}>
            观看
          </button>
          <button type="button" onClick={() => handleModeChange('layout')} className={resolveButtonClasses('layout')}>
            布局
          </button>
          <button type="button" onClick={() => handleModeChange('linking')} className={resolveButtonClasses('linking')}>
            连线
          </button>
          <button type="button" onClick={() => handleModeChange('blueprint')} className={resolveButtonClasses('blueprint')}>
            蓝图
          </button>
        </div>
        {showConnectionDeletion && (
          <button
            type="button"
            onClick={handleDeleteConnection}
            className="rounded-md border border-slate-600/70 px-3 py-1 text-xs font-medium text-slate-100 transition hover:bg-slate-800/80"
          >
            删除选中连线
          </button>
        )}
      </div>
      <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-800/70 px-2 py-1 text-[11px] text-slate-200 shadow-md shadow-slate-900/40">
        <MagnifyingGlassPlusIcon className="h-4 w-4 text-slate-300" />
        <span>{formattedScale}×</span>
      </div>
    </div>
  );
};
