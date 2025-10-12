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

export const BlueprintDrawer = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { blueprint, setBlueprint, updateBlueprint, mode, setMode } = useCanvasStore((state) => ({
    blueprint: state.blueprint,
    setBlueprint: state.setBlueprint,
    updateBlueprint: state.updateBlueprint,
    mode: state.mode,
    setMode: state.setMode
  }));
  const { addNotification } = useUIStore((state) => ({
    addNotification: state.addNotification
  }));

  if (mode !== 'blueprint') {
    return null;
  }

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const notify = (title: string, message: string, level: 'info' | 'warning' | 'error' = 'info') => {
    addNotification({
      id: nanoid(),
      title,
      message,
      level
    });
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

  const handleOffsetChange = (axis: 'x' | 'y') => (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) {
      return;
    }
    updateBlueprint({ offset: { ...blueprint?.offset, [axis]: value } });
  };

  const handleResetOffset = () => {
    updateBlueprint({ offset: { x: 0, y: 0 } });
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

  const hasBlueprint = Boolean(blueprint);

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex justify-end">
      <div className="pointer-events-auto flex h-full w-96 flex-col border-l border-slate-800/80 bg-slate-900/95 px-6 py-6 text-slate-200 shadow-xl shadow-slate-900/60">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">蓝图设置</h2>
            <p className="mt-1 text-xs text-slate-400">导入图纸并调整缩放、透明度与位置。</p>
          </div>
          <button
            type="button"
            className="rounded border border-slate-700/80 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500/80 hover:text-white"
            onClick={() => setMode('view')}
          >
            关闭
          </button>
        </div>

        <div className="mt-6 space-y-6 overflow-y-auto pr-1 text-sm">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-100">蓝图文件</h3>
              {hasBlueprint && (
                <button
                  type="button"
                  onClick={handleRemoveBlueprint}
                  className="rounded border border-rose-500/60 px-2 py-1 text-xs text-rose-200 transition hover:border-rose-400 hover:text-rose-100"
                >
                  移除蓝图
                </button>
              )}
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-slate-600/70 bg-slate-800/40 px-4 py-6 text-center text-xs text-slate-300 transition hover:border-slate-500/80 hover:text-white">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <span>{hasBlueprint ? '替换蓝图图片' : '选择蓝图图片上传'}</span>
            </label>
            {hasBlueprint ? (
              <div className="space-y-1 rounded border border-slate-800/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
                <div>原始尺寸：{blueprint.naturalWidth} × {blueprint.naturalHeight}</div>
                <div>当前位置：X {Math.round(blueprint.offset.x)}, Y {Math.round(blueprint.offset.y)}</div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">支持 PNG、JPEG、WebP，大小不超过 10MB。</p>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>缩放</span>
                <span>{(blueprint?.scale ?? 1).toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={5}
                step={0.1}
                value={blueprint?.scale ?? 1}
                onChange={handleScaleChange}
                disabled={!hasBlueprint}
                className="mt-2 w-full accent-sky-400"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>透明度</span>
                <span>{Math.round((blueprint?.opacity ?? 0.6) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={blueprint?.opacity ?? 0.6}
                onChange={handleOpacityChange}
                disabled={!hasBlueprint}
                className="mt-2 w-full accent-amber-300"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>位置偏移</span>
                <button
                  type="button"
                  onClick={handleResetOffset}
                  disabled={!hasBlueprint}
                  className="rounded border border-slate-700/70 px-2 py-0.5 text-[11px] text-slate-300 transition hover:border-slate-500/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  重置偏移
                </button>
              </div>
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col text-xs text-slate-400">
                  <span className="mb-1">X</span>
                  <input
                    type="number"
                    value={blueprint?.offset.x ?? 0}
                    onChange={handleOffsetChange('x')}
                    disabled={!hasBlueprint}
                    className="rounded border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  />
                </label>
                <label className="flex flex-1 flex-col text-xs text-slate-400">
                  <span className="mb-1">Y</span>
                  <input
                    type="number"
                    value={blueprint?.offset.y ?? 0}
                    onChange={handleOffsetChange('y')}
                    disabled={!hasBlueprint}
                    className="rounded border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  />
                </label>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
