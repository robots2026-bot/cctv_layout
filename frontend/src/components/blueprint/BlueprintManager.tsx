import { BlueprintDrawer } from './BlueprintDrawer';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';

export const BlueprintManager = () => {
  const { blueprint } = useCanvasStore((state) => ({ blueprint: state.blueprint }));
  const { blueprintMode, enterBlueprintMode } = useUIStore((state) => ({
    blueprintMode: state.blueprintMode,
    enterBlueprintMode: state.enterBlueprintMode
  }));

  const statusText = (() => {
    if (blueprintMode === 'editing') {
      return '蓝图编辑中：设备交互已暂时锁定';
    }
    if (blueprint) {
      return '蓝图已锁定，可进入模式继续调整';
    }
    return '尚未导入蓝图，可上传工地图纸作为参照层';
  })();

  const buttonLabel = blueprintMode === 'editing' ? '编辑中' : blueprint ? '编辑蓝图' : '导入蓝图';
  const buttonVariant =
    blueprintMode === 'editing'
      ? 'cursor-not-allowed border-slate-700/70 bg-slate-800/60 text-slate-400'
      : blueprint
      ? 'border-sky-500/70 bg-sky-500/20 text-sky-100 hover:border-sky-400/70 hover:bg-sky-500/30'
      : 'border-emerald-500/60 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/70 hover:bg-emerald-500/25';

  return (
    <>
      <div className="pointer-events-none absolute right-6 top-6 z-30 flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex items-center gap-3 rounded border border-slate-700/80 bg-slate-900/90 px-4 py-2 text-xs text-slate-200 shadow-lg shadow-slate-900/40">
          <span>{statusText}</span>
          <button
            type="button"
            disabled={blueprintMode === 'editing'}
            onClick={() => {
              if (blueprintMode === 'editing') {
                return;
              }
              enterBlueprintMode();
            }}
            className={`rounded border px-3 py-1 font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900/80 focus:ring-offset-2 focus:ring-offset-slate-900 ${buttonVariant}`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
      <BlueprintDrawer />
    </>
  );
};
