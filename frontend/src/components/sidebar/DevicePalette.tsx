import { useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { DeviceSummary } from '../../types/canvas';

interface DevicePaletteProps {
  projectId: string;
}

export const DevicePalette = ({ projectId }: DevicePaletteProps) => {
  const { availableDevices, fetchAvailableDevices } = useRealtimeStore((state) => ({
    availableDevices: state.availableDevices,
    fetchAvailableDevices: state.fetchAvailableDevices
  }));
  const addDeviceToCanvas = useCanvasStore((state) => state.addDeviceToCanvas);
  const placedCount = useCanvasStore((state) => state.elements.length);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      setIsLoading(true);
      fetchAvailableDevices(projectId).finally(() => setIsLoading(false));
    }
  }, [fetchAvailableDevices, projectId]);

  const handleAdd = (device: DeviceSummary) => {
    addDeviceToCanvas(device);
  };

  const stats = useMemo(() => {
    const unplaced = availableDevices.length;
    const placed = placedCount;
    const total = unplaced + placed;
    return {
      total,
      unplaced,
      placed
    };
  }, [availableDevices.length, placedCount]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800/80 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">未布局设备资源</h2>
        <p className="mt-1 text-xs text-slate-500">
          点击条目立即将设备放置到画布。统计数据基于当前布局与待分配设备。
        </p>
      </div>
      <div className="border-b border-slate-800/80 px-4 py-3">
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
          <div className="rounded border border-slate-800/80 bg-slate-900/70 px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">总数</div>
            <div className="mt-1 text-base font-semibold text-slate-100">{stats.total}</div>
          </div>
          <div className="rounded border border-slate-800/80 bg-slate-900/70 px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">未布局</div>
            <div className="mt-1 text-base font-semibold text-amber-300">{stats.unplaced}</div>
          </div>
          <div className="rounded border border-slate-800/80 bg-slate-900/70 px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">已布局</div>
            <div className="mt-1 text-base font-semibold text-emerald-300">{stats.placed}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && (
          <div className="rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">
            获取设备数据...
          </div>
        )}
        {!isLoading && availableDevices.length === 0 && (
          <div className="rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">
            暂无等待布局的设备
          </div>
        )}
        <ul className="mt-2 space-y-2 text-xs text-slate-300">
          {availableDevices.map((device) => (
            <li key={device.id}>
              <button
                type="button"
                onClick={() => handleAdd(device)}
                className="flex w-full flex-col rounded border border-slate-800/80 bg-slate-900/60 p-2 text-left transition hover:border-brand-400/80 hover:bg-slate-900"
              >
                <span className="text-sm font-medium text-slate-100">{device.name}</span>
                <span className="mt-1 text-xs text-slate-400">{device.type}</span>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{device.ip ?? '待分配 IP'}</span>
                  {device.status && (
                    <span
                      className={
                        device.status === 'online'
                          ? 'text-emerald-400'
                          : device.status === 'offline'
                          ? 'text-rose-400'
                          : 'text-slate-500'
                      }
                    >
                      {device.status}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
