import { DragEvent, useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { DeviceSummary } from '../../types/canvas';
import { DEVICE_DRAG_DATA_FORMAT } from '../../utils/dragDrop';
import { DeviceCategory, getDeviceCategory, getStatusVisual } from '../../utils/deviceVisual';

interface DevicePaletteProps {
  projectId: string;
}

const DeviceListIcon = ({ category }: { category: DeviceCategory }) => {
  if (category === 'bridge') {
    return (
      <svg viewBox="0 0 32 32" className="h-8 w-8 text-sky-300" aria-hidden="true">
        <rect
          x="12"
          y="4"
          width="8"
          height="24"
          rx="3"
          fill="#0f172a"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="16" cy="10" r="2" fill="currentColor" />
        <circle cx="16" cy="16" r="2" fill="currentColor" opacity="0.7" />
        <circle cx="16" cy="22" r="2" fill="currentColor" opacity="0.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 text-emerald-300" aria-hidden="true">
      <rect
        x="6"
        y="8"
        width="20"
        height="16"
        rx="6"
        fill="#0f172a"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="16" cy="16" r="6" fill="currentColor" />
      <circle cx="16" cy="16" r="2.5" fill="#0f172a" />
    </svg>
  );
};

export const DevicePalette = ({ projectId }: DevicePaletteProps) => {
  const { availableDevices, fetchAvailableDevices } = useRealtimeStore((state) => ({
    availableDevices: state.availableDevices,
    fetchAvailableDevices: state.fetchAvailableDevices
  }));
  const elements = useCanvasStore((state) => state.elements);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      setIsLoading(true);
      fetchAvailableDevices(projectId).finally(() => setIsLoading(false));
    }
  }, [fetchAvailableDevices, projectId]);

  const handleDragStart = (event: DragEvent<HTMLDivElement>, device: DeviceSummary) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(DEVICE_DRAG_DATA_FORMAT, JSON.stringify(device));
    event.dataTransfer.setData('application/json', JSON.stringify(device));
    event.dataTransfer.setData('text/plain', device.name);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const stats = useMemo(() => {
    const placedCount = elements.filter((element) => Boolean(element.deviceId)).length;
    const unplaced = availableDevices.length;
    const placed = placedCount;
    const total = unplaced + placed;
    return {
      total,
      unplaced,
      placed
    };
  }, [availableDevices.length, elements]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800/80 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">未布局设备资源</h2>
        <p className="mt-1 text-xs text-slate-500">拖拽设备到画布即可完成布点。</p>
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
          {availableDevices.map((device) => {
            const category = getDeviceCategory(device.type);
            const status = getStatusVisual(device.status);
            return (
              <li key={device.id}>
                <div
                  draggable
                  onDragStart={(event) => handleDragStart(event, device)}
                  className="flex w-full cursor-grab items-center gap-2 rounded border border-slate-800/80 bg-slate-900/60 px-2 py-2 text-left transition hover:border-brand-400/80 hover:bg-slate-900 active:cursor-grabbing"
                >
                  <DeviceListIcon category={category} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 max-w-full truncate text-sm font-medium text-slate-100">
                        {device.name}
                      </span>
                      <span
                        className="inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: status.fill, opacity: status.opacity ?? 1 }}
                      />
                      <span className="text-[11px] text-slate-400">{status.label}</span>
                    </div>
                    <span className="truncate text-xs text-slate-400">{device.ip ?? '待分配 IP'}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
