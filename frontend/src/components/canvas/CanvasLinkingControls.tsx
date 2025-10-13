import { LockClosedIcon, LockOpenIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/solid';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasMode } from '../../stores/canvasStore';
import { BlueprintControlsBar } from '../blueprint/BlueprintControlsBar';

export const CanvasLinkingControls = () => {
  const {
    mode,
    setMode,
    cancelLinking,
    selectedConnectionId,
    removeConnection,
    viewportScale,
    setViewport,
    isLocked,
    setLocked,
    toggleLocked
  } = useCanvasStore((state) => ({
    mode: state.mode,
    setMode: state.setMode,
    cancelLinking: state.cancelLinking,
    selectedConnectionId: state.selectedConnectionId,
    removeConnection: state.removeConnection,
    viewportScale: state.viewport.scale,
    setViewport: state.setViewport,
    isLocked: state.isLocked,
    setLocked: state.setLocked,
    toggleLocked: state.toggleLocked
  }));
  const formattedScale = viewportScale.toFixed(viewportScale >= 1 ? 1 : 2);

  const handleModeChange = (nextMode: CanvasMode) => {
    if (mode === 'linking' && nextMode !== 'linking') {
      cancelLinking();
    }
    if (nextMode === 'linking') {
      cancelLinking();
    }
    if (mode === 'view' && nextMode !== 'view') {
      setLocked(true);
    }
    setMode(nextMode);
  };

  const handleDeleteConnection = () => {
    if (mode !== 'linking' || isLocked) {
      return;
    }
    if (selectedConnectionId) {
      removeConnection(selectedConnectionId);
    }
  };

  const handleResetZoom = () => {
    setViewport({ scale: 1 });
  };

  const resolveButtonClasses = (targetMode: CanvasMode) =>
    `rounded-md border px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:ring-offset-2 focus:ring-offset-slate-900 ${
      mode === targetMode
        ? 'border-sky-400 bg-sky-500 text-white shadow-inner shadow-sky-900/50'
        : 'border-transparent bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
    }`;

  const showConnectionDeletion = mode === 'linking' && Boolean(selectedConnectionId);

  return (
    <div className="pointer-events-none absolute left-6 top-6 z-30 flex flex-wrap items-center gap-3">
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
            disabled={isLocked}
            className="rounded-md border border-slate-600/70 px-3 py-1 text-xs font-medium text-slate-100 transition hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:border-slate-800/60 disabled:text-slate-500"
          >
            删除选中连线
          </button>
        )}
      </div>
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleResetZoom}
          className="flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-800/70 px-3 py-1 text-[11px] text-slate-200 transition hover:bg-slate-700/70"
        >
          <MagnifyingGlassPlusIcon className="h-4 w-4 text-slate-300" />
          <span>{formattedScale}×</span>
        </button>
        {mode !== 'view' && (
          <button
            type="button"
            onClick={toggleLocked}
            className={`flex items-center gap-1 rounded-md border px-3 py-1 text-[11px] transition focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              isLocked
                ? 'border-slate-700/80 bg-slate-800/70 text-slate-200 hover:bg-slate-700/70'
                : 'border-emerald-500/70 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
            }`}
          >
            {isLocked ? <LockClosedIcon className="h-4 w-4" /> : <LockOpenIcon className="h-4 w-4" />}
            <span>{isLocked ? '已锁定' : '可编辑'}</span>
          </button>
        )}
        {mode === 'blueprint' && <BlueprintControlsBar />}
      </div>
    </div>
  );
};
