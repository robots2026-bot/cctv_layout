import { ChangeEvent, useRef } from 'react';
import { MagnifyingGlassPlusIcon, SunIcon } from '@heroicons/react/24/solid';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';
import { nanoid } from '../../utils/nanoid';
import { useLayoutStore } from '../../stores/layoutStore';
import { uploadBlueprintFile } from '../../services/fileUploads';

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

export const BlueprintControlsBar = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { blueprint, setBlueprint, updateBlueprint, isLocked } = useCanvasStore((state) => ({
    blueprint: state.blueprint,
    setBlueprint: state.setBlueprint,
    updateBlueprint: state.updateBlueprint,
    isLocked: state.isLocked
  }));
  const { addNotification } = useUIStore((state) => ({
    addNotification: state.addNotification
  }));
  const layout = useLayoutStore((state) => state.layout);

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

    if (!layout) {
      notify('无法上传蓝图', '请先加载布局后再尝试导入蓝图', 'error');
      resetFileInput();
      return;
    }

    const limitBytes = 20 * 1024 * 1024;
    if (file.size > limitBytes) {
      notify('文件过大', '图纸大小需小于 20MB', 'error');
      resetFileInput();
      return;
    }

    try {
      notify('蓝图上传中', `正在上传图纸 "${file.name}"，请稍候…`, 'info');
      const uploadResult = await uploadBlueprintFile(file, {
        projectId: layout.projectId,
        layoutId: layout.id
      });
      const width = uploadResult.width ?? uploadResult.dimensions.width;
      const height = uploadResult.height ?? uploadResult.dimensions.height;
      const sizeBytes = uploadResult.sizeBytes ?? file.size;
      setBlueprint({
        url: uploadResult.url,
        naturalWidth: width,
        naturalHeight: height,
        scale: 1,
        opacity: 0.6,
        offset: { x: 0, y: 0 },
        fileId: uploadResult.id
      });
      notify(
        '蓝图已导入',
        `图纸 "${file.name}" 已上传，尺寸 ${width}×${height}，约 ${formatBytes(sizeBytes)}`,
        'info'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法读取图片尺寸，请重试或更换文件';
      notify('图纸加载失败', message, 'error');
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

  const applyScale = (nextScale: number) => {
    if (!blueprint) {
      return;
    }
    const clampedScale = Math.min(5, Math.max(0.1, nextScale));
    const baseWidth = blueprint.naturalWidth || 0;
    const baseHeight = blueprint.naturalHeight || 0;
    if (baseWidth <= 0 || baseHeight <= 0) {
      updateBlueprint({ scale: clampedScale });
      return;
    }
    const currentWidth = baseWidth * (blueprint.scale || 1);
    const currentHeight = baseHeight * (blueprint.scale || 1);
    const centerX = blueprint.offset.x + currentWidth / 2;
    const centerY = blueprint.offset.y + currentHeight / 2;
    const newWidth = baseWidth * clampedScale;
    const newHeight = baseHeight * clampedScale;
    const nextOffset = {
      x: centerX - newWidth / 2,
      y: centerY - newHeight / 2
    };
    updateBlueprint({ scale: clampedScale, offset: nextOffset });
  };

  const handleScaleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    applyScale(value);
  };

  const handleOpacityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    updateBlueprint({ opacity: Math.min(1, Math.max(0, value)) });
  };

  const handleResetScale = () => {
    applyScale(1);
  };

  const handleResetOpacity = () => {
    updateBlueprint({ opacity: 0.5 });
  };

  const handleRemoveBlueprint = () => {
    if (!blueprint) {
      return;
    }
    if (!window.confirm('确认移除当前蓝图吗？')) {
      return;
    }
    setBlueprint(null);
    notify('蓝图已移除', '已清除画布蓝图图层', 'warning');
  };

  const controlsDisabled = isLocked || !hasBlueprint;

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
          <button
            type="button"
            onClick={handleResetScale}
            disabled={controlsDisabled}
            className="flex items-center gap-1 rounded-md border border-slate-700/70 bg-slate-800/70 px-2 py-1 text-slate-200 transition hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MagnifyingGlassPlusIcon className="h-4 w-4" />
            <span className="min-w-[24px] text-right">{(blueprint?.scale ?? 1).toFixed(2)}×</span>
          </button>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={blueprint?.scale ?? 1}
            onChange={handleScaleChange}
            disabled={controlsDisabled}
            aria-label="蓝图缩放"
            className="w-28 accent-sky-400 disabled:opacity-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetOpacity}
            disabled={controlsDisabled}
            className="flex items-center gap-1 rounded-md border border-slate-700/70 bg-slate-800/70 px-2 py-1 text-slate-200 transition hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SunIcon className="h-4 w-4" />
            <span className="min-w-[30px] text-right">{Math.round((blueprint?.opacity ?? 0.6) * 100)}%</span>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={blueprint?.opacity ?? 0.6}
            onChange={handleOpacityChange}
            disabled={controlsDisabled}
            aria-label="蓝图透明度"
            className="w-24 accent-amber-300 disabled:opacity-40"
          />
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
