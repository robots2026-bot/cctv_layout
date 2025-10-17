import { Dialog, Transition } from '@headlessui/react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { DragEvent, FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { DeviceSummary } from '../../types/canvas';
import { DEVICE_DRAG_DATA_FORMAT } from '../../utils/dragDrop';
import {
  DeviceCategory,
  deriveSwitchLabel,
  getDeviceCategory,
  getDeviceTypeVisual,
  getStatusVisual
} from '../../utils/deviceVisual';

interface DevicePaletteProps {
  projectId: string;
}

const DeviceListIcon = ({
  category,
  accent,
  label
}: {
  category: DeviceCategory;
  accent: string;
  label?: string;
}) => {
  if (category === 'switch') {
    return (
      <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="#0f172a"
          stroke={accent}
          strokeWidth="2"
        />
        <text
          x="20"
          y="23"
          textAnchor="middle"
          fontSize="11"
          fontFamily="Inter, system-ui, monospace"
          fill={accent}
        >
          {deriveSwitchLabel(label)}
        </text>
      </svg>
    );
  }
  if (category === 'bridge') {
    return (
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true" style={{ color: accent }}>
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
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true" style={{ color: accent }}>
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
  const { availableDevices, fetchAvailableDevices, registerDevice } = useRealtimeStore((state) => ({
    availableDevices: state.availableDevices,
    fetchAvailableDevices: state.fetchAvailableDevices,
    registerDevice: state.registerDevice
  }));
  const elements = useCanvasStore((state) => state.elements);
  const [isLoading, setIsLoading] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', type: 'Camera', model: '', ip: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const resetManualState = () => {
    setManualForm({ name: '', type: 'Camera', model: '', ip: '' });
    setIsSubmitting(false);
    setSubmitError(null);
  };

  const closeManualDialog = () => {
    setIsManualDialogOpen(false);
    resetManualState();
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectId) return;

    const trimmedName = manualForm.name.trim();
    const trimmedType = manualForm.type.trim();
    const trimmedModel = manualForm.model.trim();
    const trimmedIp = manualForm.ip.trim();
    const requiresIp = trimmedType.toLowerCase() !== 'switch';

    if (!trimmedType || !trimmedModel || (requiresIp && !trimmedIp)) {
      setSubmitError(requiresIp ? '请填写设备类型、设备型号与 IP 地址' : '请填写设备类型与设备型号');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const result = await registerDevice(projectId, {
      name: trimmedName,
      type: trimmedType,
      model: trimmedModel,
      ip: trimmedIp || undefined
    });

    if (!result) {
      setSubmitError('设备创建失败，请稍后重试');
      setIsSubmitting(false);
      return;
    }

    closeManualDialog();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800/80 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">未布局设备资源</h2>
            <p className="mt-1 text-xs text-slate-500">拖拽设备到画布即可完成布点。</p>
          </div>
          <button
            type="button"
            onClick={() => setIsManualDialogOpen(true)}
            disabled={!projectId}
            className="inline-flex items-center gap-1 rounded border border-brand-500/40 bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-200 transition hover:border-brand-400/70 hover:bg-brand-500/20 hover:text-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            手动添加
          </button>
        </div>
      </div>
      <div className="border-b border-slate-800/80 px-3 py-2">
        <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
          <div className="rounded border border-slate-800/70 bg-slate-900/70 px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">总数</div>
            <div className="mt-1 text-base font-semibold text-slate-100">{stats.total}</div>
          </div>
          <div className="rounded border border-slate-800/70 bg-slate-900/70 px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">未布局</div>
            <div className="mt-1 text-base font-semibold text-amber-300">{stats.unplaced}</div>
          </div>
          <div className="rounded border border-slate-800/70 bg-slate-900/70 px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">已布局</div>
            <div className="mt-1 text-base font-semibold text-emerald-300">{stats.placed}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
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
            const typeVisual = getDeviceTypeVisual(device.type);
            const deviceName = device.name?.trim() ? device.name : typeVisual.label;
            return (
              <li key={device.id}>
                <div
                  draggable
                  onDragStart={(event) => handleDragStart(event, device)}
                  className="flex w-full cursor-grab items-center gap-2 rounded border px-2 py-2 text-left transition hover:ring-2 hover:ring-slate-100/60 active:cursor-grabbing"
                  style={{
                    backgroundColor: status.nodeFill,
                    borderColor: status.fill
                  }}
                >
                  <DeviceListIcon
                    category={category}
                    accent={status.textColor}
                    label={device.model ?? device.name}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="min-w-0 max-w-full truncate text-sm font-semibold"
                        style={{ color: status.textColor }}
                      >
                        {deviceName}
                      </span>
                      <span
                        className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          borderColor: typeVisual.accent,
                          color: typeVisual.text,
                          backgroundColor: typeVisual.background
                        }}
                      >
                        {typeVisual.label}
                      </span>
                    </div>
                    <div className="flex flex-col text-[11px]" style={{ color: status.secondaryTextColor }}>
                      <span className="truncate">
                        型号：{device.model?.trim() ? device.model : '—'}
                      </span>
                      <span className="truncate">IP：{device.ip ?? '待分配'}</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <ManualDeviceDialog
        open={isManualDialogOpen}
        onClose={closeManualDialog}
        form={manualForm}
        onChange={setManualForm}
        onSubmit={handleManualSubmit}
        isSubmitting={isSubmitting}
        errorMessage={submitError}
      />
    </div>
  );
};

interface ManualDeviceDialogProps {
  open: boolean;
  onClose: () => void;
  form: { name: string; type: string; model: string; ip: string };
  onChange: (next: { name: string; type: string; model: string; ip: string }) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}

const MANUAL_DEVICE_TYPES = [
  { label: 'Camera', value: 'Camera' },
  { label: 'NVR', value: 'NVR' },
  { label: 'Bridge', value: 'Bridge' },
  { label: 'Switch', value: 'Switch' }
];

const ManualDeviceDialog = ({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
  isSubmitting,
  errorMessage
}: ManualDeviceDialogProps) => (
  <Transition show={open} as={Fragment}>
    <Dialog onClose={onClose} className="relative z-50">
      <Transition.Child
        as={Fragment}
        enter="transition-opacity ease-linear duration-200"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-linear duration-150"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
      </Transition.Child>

      <div className="fixed inset-0 flex justify-end">
        <Transition.Child
          as={Fragment}
          enter="transform transition ease-in-out duration-300"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="transform transition ease-in-out duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
        >
          <Dialog.Panel className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950/95 p-6 shadow-2xl">
            <Dialog.Title className="text-lg font-semibold text-white">手动添加设备</Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-slate-400">
              填写设备基础信息，保存后可立即拖入画布完成布点。
            </Dialog.Description>

            <form
              className="mt-6 flex flex-1 flex-col gap-4 overflow-y-auto pr-1 text-sm text-slate-200"
              onSubmit={onSubmit}
            >
              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-slate-300">
                  设备名称
                </span>
                <input
                  value={form.name}
                  onChange={(event) => onChange({ ...form, name: event.target.value })}
                  maxLength={120}
                  placeholder="例如：1#塔吊摄像头"
                  className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-slate-300">
                  设备类型 <span className="text-rose-300">*</span>
                </span>
                <select
                  value={form.type}
                  onChange={(event) => onChange({ ...form, type: event.target.value })}
                  required
                  className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-brand-400/80 focus:outline-none"
                >
                  {MANUAL_DEVICE_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500">当前支持 Camera、NVR、Bridge、Switch 四类设备。</span>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-slate-300">
                  设备型号 <span className="text-rose-300">*</span>
                </span>
                <input
                  value={form.model}
                  onChange={(event) => onChange({ ...form, model: event.target.value })}
                  required
                  maxLength={80}
                  placeholder="例如：DS-2DE4225IW"
                  className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500">填写设备铭牌或系统型号，便于后续维护排查。</span>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-slate-300">
                  IP 地址 <span className="text-rose-300">*</span>
                </span>
                <input
                  value={form.ip}
                  onChange={(event) => onChange({ ...form, ip: event.target.value })}
                  required={form.type !== 'Switch'}
                  maxLength={45}
                  placeholder="例如：192.168.10.15"
                  className="w-full rounded border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500">支持 IPv4 或 IPv6（Switch 类型可留空）。</span>
              </label>

              {errorMessage && (
                <div className="rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                  {errorMessage}
                </div>
              )}

              <div className="mt-auto flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded border border-brand-500/70 bg-brand-500/20 px-3 py-2 text-xs font-semibold text-brand-100 transition hover:border-brand-400/80 hover:bg-brand-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? '保存中...' : '保存设备'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </Dialog>
  </Transition>
);
