import { ChangeEvent, useRef } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';
import { nanoid } from '../../utils/nanoid';

const loadImageDimensions = (url: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = (event) => reject(event);
    image.src = url;
  });

export const BlueprintControlsBar = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { blueprint, setBlueprint, updateBlueprint, isLocked, focusAllElements, elements } = useCanvasStore((state) => ({
    blueprint: state.blueprint,
    setBlueprint: state.setBlueprint,
    updateBlueprint: state.updateBlueprint,
    isLocked: state.isLocked,
    focusAllElements: state.focusAllElements,
    elements: state.elements
  }));
  const { addNotification } = useUIStore((state) => ({
    addNotification: state.addNotification
  }));

  const hasBlueprint = Boolean(blueprint);

  const notify = (title: string, message: string, level: 'info' | 'warning' | 'error' = 'info') => {
    addNotification({
      id: nanoid(),
      title,
      message,
      level
    });
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      notify('文件类型不支持', '请选择 PNG、JPEG 或 WebP 格式的图片', 'error');
      resetFileInput();
      return;
    }

    const limitBytes = 10 * 1024 * 1024;
    if (file.size > limitBytes) {
      notify('文件过大', '图纸大小需小于 10MB', 'error');
      resetFileInput();
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const { width, height } = await loadImageDimensions(objectUrl);
      const previousUrl = blueprint?.url;
      setBlueprint({
        url: objectUrl,
        naturalWidth: width,
        naturalHeight: height,
        scale: 1,
        opacity: 0.6,
        offset: { x: 0, y: 0 }
      });
      if (previousUrl && previousUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previousUrl);
      }
      notify('蓝图已导入', `图纸 "${file.name}" 已添加到画布`, 'info');
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      notify('图纸加载失败', '无法读取图片尺寸，请重试或更换文件', 'error');
    } finally {
      resetFileInput();
    }
  };

  const handleImportClick = () => {
    if (isLocked) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleScaleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    updateBlueprint({ scale: Math.min(5, Math.max(0.1, value)) });
  };

  const handleOpacityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    updateBlueprint({ opacity: Math.min(1, Math.max(0, value)) });
  };

  const handleRemoveBlueprint = () => {
    if (!blueprint) {
      return;
    }
    if (!window.confirm('确认移除当前蓝图吗？此操作不可撤销。')) {
      return;
    }
    if (blueprint.url.startsWith('blob:')) {
      URL.revokeObjectURL(blueprint.url);
    }
    setBlueprint(null);
    notify('蓝图已移除', '已清除画布蓝图图层', 'warning');
  };

  const controlsDisabled = isLocked || !hasBlueprint;

  const handleFocusAllElements = () => {
    if (elements.length === 0) {
      return;
    }
    focusAllElements();
  };

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-4 rounded-lg border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-xs text-slate-200 shadow-md shadow-slate-900/40">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleImportClick}
            disabled={isLocked}
            className="rounded border border-sky-500/60 px-2 py-1 text-[11px] text-sky-200 transition hover:border-sky-400 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-700/60 disabled:text-slate-500"
          >
            {hasBlueprint ? '替换蓝图' : '导入蓝图'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">缩放</span>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={blueprint?.scale ?? 1}
            onChange={handleScaleChange}
            disabled={controlsDisabled}
            className="w-28 accent-sky-400 disabled:opacity-40"
          />
          <span className="w-12 text-right text-slate-300">{(blueprint?.scale ?? 1).toFixed(2)}×</span>
          <button
            type="button"
            onClick={handleFocusAllElements}
            disabled={elements.length === 0}
            className="rounded border border-emerald-500/60 px-2 py-1 text-[11px] text-emerald-200 transition hover:border-emerald-400 hover:text-emerald-100 disabled:cursor-not-allowed disabled:border-slate-700/60 disabled:text-slate-500"
          >
            显示全部
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">透明</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={blueprint?.opacity ?? 0.6}
            onChange={handleOpacityChange}
            disabled={controlsDisabled}
            className="w-24 accent-amber-300 disabled:opacity-40"
          />
          <span className="w-12 text-right text-slate-300">{Math.round((blueprint?.opacity ?? 0.6) * 100)}%</span>
        </div>
        <button
          type="button"
          onClick={handleRemoveBlueprint}
          disabled={controlsDisabled}
          className="rounded border border-rose-500/60 px-2 py-1 text-[11px] text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:cursor-not-allowed disabled:border-rose-900/40 disabled:text-rose-900/60"
        >
          移除
        </button>
      </div>
    </div>
  );
};
