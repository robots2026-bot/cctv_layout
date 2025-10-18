import { ChangeEvent, useRef } from 'react';
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
