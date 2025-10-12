import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';

export const CanvasLinkingControls = () => {
  const {
    mode,
    setMode,
    linking,
    cancelLinking,
    selectedConnectionId,
    removeConnection
  } = useCanvasStore((state) => ({
    mode: state.mode,
    setMode: state.setMode,
    linking: state.linking,
    cancelLinking: state.cancelLinking,
    selectedConnectionId: state.selectedConnectionId,
    removeConnection: state.removeConnection
  }));
  const blueprintMode = useUIStore((state) => state.blueprintMode);
  const isBlueprintEditing = blueprintMode === 'editing';

  const handleModeChange = (nextMode: 'view' | 'layout' | 'linking') => {
    if (isBlueprintEditing) {
      return;
    }
    if (nextMode === 'linking') {
      cancelLinking();
      setMode('linking');
    } else {
      if (mode === 'linking') {
        cancelLinking();
      }
      setMode(nextMode);
    }
  };

  const hint = isBlueprintEditing
    ? '蓝图编辑中，连线控制已暂停'
    : mode === 'linking'
    ? linking.fromElementId
      ? '拖动到目标设备松开即可连线；点击空白取消'
      : '按下并拖动起点设备开始连线'
    : '进入连线模式以连接设备';

  const handleDeleteConnection = () => {
    if (selectedConnectionId) {
      removeConnection(selectedConnectionId);
    }
  };

  return (
    <div className="pointer-events-none absolute left-6 top-6 z-30 flex flex-col gap-2">
      <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded border border-slate-700/80 bg-slate-900/90 px-4 py-2 shadow-lg shadow-slate-900/40">
        <div className="flex items-center gap-2 text-xs text-slate-200/90">
          <span>模式：</span>
          <button
            type="button"
            disabled={isBlueprintEditing}
            onClick={() => handleModeChange('view')}
            className={`rounded px-3 py-1 font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              mode === 'view' ? 'bg-slate-500/90 text-white' : 'bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
            } ${isBlueprintEditing ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            观看
          </button>
          <button
            type="button"
            disabled={isBlueprintEditing}
            onClick={() => handleModeChange('layout')}
            className={`rounded px-3 py-1 font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              mode === 'layout' ? 'bg-sky-500/90 text-white' : 'bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
            } ${isBlueprintEditing ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            布局
          </button>
          <button
            type="button"
            disabled={isBlueprintEditing}
            onClick={() => handleModeChange('linking')}
            className={`rounded px-3 py-1 font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              mode === 'linking' ? 'bg-rose-500/90 text-white' : 'bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
            } ${isBlueprintEditing ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            连线
          </button>
        </div>
        <span className="text-xs text-slate-200/90">{hint}</span>
        {!isBlueprintEditing && mode === 'linking' && selectedConnectionId && (
          <button
            type="button"
            onClick={handleDeleteConnection}
            className="rounded border border-slate-600/70 px-3 py-1 text-xs font-medium text-slate-100 transition hover:bg-slate-800/80"
          >
            删除选中连线
          </button>
        )}
      </div>
    </div>
  );
};
