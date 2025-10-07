import { useEffect } from 'react';
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

  useEffect(() => {
    if (projectId) {
      fetchAvailableDevices(projectId);
    }
  }, [fetchAvailableDevices, projectId]);

  const handleAdd = (device: DeviceSummary) => {
    addDeviceToCanvas(device);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">设备资源</h2>
        <p className="mt-1 text-xs text-slate-500">拖拽或点击添加设备到画布</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <ul className="space-y-2 text-xs text-slate-300">
          {availableDevices.length === 0 && <li>暂无可用设备</li>}
          {availableDevices.map((device) => (
            <li key={device.id}>
              <button
                type="button"
                onClick={() => handleAdd(device)}
                className="flex w-full flex-col rounded border border-slate-800/80 bg-slate-900/60 p-2 text-left hover:border-brand-400/80"
              >
                <span className="text-sm font-medium text-slate-100">{device.name}</span>
                <span className="text-xs text-slate-400">{device.type}</span>
                <span className="text-[10px] text-slate-500">{device.ip ?? '待分配 IP'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
