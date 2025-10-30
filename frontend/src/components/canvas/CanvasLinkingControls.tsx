import {
  ArrowsPointingOutIcon,
  CloudArrowUpIcon,
  LockClosedIcon,
  LockOpenIcon,
  MagnifyingGlassPlusIcon,
  QueueListIcon
} from '@heroicons/react/24/solid';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasMode } from '../../stores/canvasStore';
import { BlueprintControlsBar } from '../blueprint/BlueprintControlsBar';
import { useLayoutStore } from '../../stores/layoutStore';
import { useUIStore } from '../../stores/uiStore';
import { buildTreeLayout } from '../../utils/treeLayout';

export const CanvasLinkingControls = () => {
  const {
    mode,
    setMode,
    cancelLinking,
    viewportScale,
    setViewport,
    isLocked,
    setLocked,
    toggleLocked,
    focusAllElements,
    elements,
    blueprint,
    blueprintStatus,
    isDirty,
    viewport,
    lastFocusCenter
  } = useCanvasStore((state) => ({
    mode: state.mode,
    setMode: state.setMode,
    cancelLinking: state.cancelLinking,
    viewportScale: state.viewport.scale,
    setViewport: state.setViewport,
    isLocked: state.isLocked,
    setLocked: state.setLocked,
    toggleLocked: state.toggleLocked,
    focusAllElements: state.focusAllElements,
    elements: state.elements,
    blueprint: state.blueprint,
    blueprintStatus: state.blueprintStatus,
    isDirty: state.isDirty,
    viewport: state.viewport,
    lastFocusCenter: state.lastFocusCenter
  }));
  const { saveLayout, isSaving } = useLayoutStore((state) => ({
    saveLayout: state.saveLayout,
    isSaving: state.isSaving
  }));
  const { addNotification, treeViewMode, setTreeViewMode } = useUIStore((state) => ({
    addNotification: state.addNotification,
    treeViewMode: state.treeViewMode,
    setTreeViewMode: state.setTreeViewMode
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
    if (nextMode !== 'view' && treeViewMode) {
      setTreeViewMode(false);
    }
    if (nextMode === 'view' && mode !== 'view' && isDirty) {
      addNotification({
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        title: '有未保存的布局更新',
        message: '请点击右侧“保存布局”按钮，以免丢失最新更改。',
        level: 'warning'
      });
    }
    setMode(nextMode);
  };

  const handleResetZoom = () => {
    const width = viewport.width ?? 0;
    const height = viewport.height ?? 0;
    if (lastFocusCenter && width > 0 && height > 0) {
      const position = {
        x: width / 2 - lastFocusCenter.x,
        y: height / 2 - lastFocusCenter.y
      };
      setViewport({ scale: 1, position });
      return;
    }
    setViewport({ scale: 1, position: { x: 0, y: 0 } });
  };

  const handleFocusAllElements = () => {
    if (elements.length === 0 && !blueprint) {
      return;
    }
    focusAllElements();
  };

  const handleToggleTreeView = () => {
    if (mode !== 'view') {
      return;
    }
    if (!treeViewMode) {
      const store = useCanvasStore.getState();
      const layout = buildTreeLayout(store.elements, store.connections);
      const width = store.viewport.width ?? 0;
      const height = store.viewport.height ?? 0;
      if (layout.nodes.length === 0) {
        addNotification({
          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          title: '无法生成树形图',
          message: '当前布局未包含 OFC 交换机。',
          level: 'warning'
        });
        return;
      }
      setTreeViewMode(true);
      if (width > 0 && height > 0) {
        const xs = layout.nodes.map((node) => node.position.x);
        const ys = layout.nodes.map((node) => node.position.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const center = {
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2
        };
        setViewport({
          scale: 1,
          position: {
            x: width / 2 - center.x,
            y: height / 2 - center.y
          }
        });
      } else {
        setViewport({ scale: 1, position: { x: 0, y: 0 } });
      }
    } else {
      setTreeViewMode(false);
    }
  };

  const hasContent = elements.length > 0 || Boolean(blueprint);

  const resolveButtonClasses = (targetMode: CanvasMode) =>
    `rounded-md border px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:ring-offset-2 focus:ring-offset-slate-900 ${
      mode === targetMode
        ? 'border-sky-400 bg-sky-500 text-white shadow-inner shadow-sky-900/50'
        : 'border-transparent bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
    }`;

  const handleSave = async () => {
    try {
      await saveLayout();
    } catch (error) {
      console.error('保存布局失败', error);
    }
  };

  const saveButtonClassName = `relative flex items-center gap-1 rounded-md border px-3 py-1 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 ${
    isDirty ? 'border-sky-500/70 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30' : 'border-slate-700/80 bg-slate-800/70 text-slate-300 hover:bg-slate-700/70'
  }`;

  const isSaveVisible = mode === 'layout' || mode === 'linking' || mode === 'blueprint';

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
      </div>
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetZoom}
            className="flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-800/70 px-3 py-1 text-[11px] text-slate-200 transition hover:bg-slate-700/70"
          >
            <MagnifyingGlassPlusIcon className="h-4 w-4 text-slate-300" />
            <span>{formattedScale}×</span>
          </button>
          <button
            type="button"
            onClick={handleFocusAllElements}
            disabled={!hasContent}
            className="flex items-center gap-1 rounded-md border border-emerald-500/60 bg-emerald-500/20 px-3 py-1 text-[11px] text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-100 disabled:cursor-not-allowed disabled:border-slate-700/60 disabled:bg-transparent disabled:text-slate-500"
          >
            <ArrowsPointingOutIcon className="h-4 w-4" />
            <span>显示全部</span>
          </button>
          <button
            type="button"
            onClick={handleToggleTreeView}
            disabled={mode !== 'view' || !hasContent}
            className={`flex items-center gap-1 rounded-md border px-3 py-1 text-[11px] transition focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              treeViewMode
                ? 'border-sky-400 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30'
                : 'border-slate-700/80 bg-slate-800/70 text-slate-200 hover:bg-slate-700/70'
            } disabled:cursor-not-allowed disabled:border-slate-700/60 disabled:bg-transparent disabled:text-slate-500`}
          >
            <QueueListIcon className="h-4 w-4" />
            <span>树形图</span>
          </button>
          {blueprint && blueprintStatus === 'loading' && (
            <span className="text-[11px] text-slate-400">蓝图加载中…</span>
          )}
          {blueprint && blueprintStatus === 'error' && (
            <span className="text-[11px] text-rose-300" role="alert">
              蓝图加载失败
            </span>
          )}
        </div>
        {isSaveVisible && (
          <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className={saveButtonClassName}
            >
              <CloudArrowUpIcon className="h-4 w-4" />
              <span>{isSaving ? '保存中...' : '保存布局'}</span>
              {isDirty && !isSaving && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        )}
        {mode === 'blueprint' && <BlueprintControlsBar />}
      </div>
    </div>
  );
};
