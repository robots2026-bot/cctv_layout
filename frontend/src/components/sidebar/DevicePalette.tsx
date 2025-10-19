import { Dialog, Transition } from '@headlessui/react';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { AxiosError } from 'axios';
import { DragEvent, FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { useUIStore } from '../../stores/uiStore';
import { DeviceSummary } from '../../types/canvas';
import { DEVICE_DRAG_DATA_FORMAT } from '../../utils/dragDrop';
import {
  DeviceCategory,
  getDeviceCategory,
  getDeviceTypeVisual,
  getStatusVisual
} from '../../utils/deviceVisual';

type ManualDeviceForm = {
  name: string;
  type: string;
  model: string;
  ip: string;
  bridgeRole: 'AP' | 'ST';
};

interface DevicePaletteProps {
  projectId: string;
}

const DeviceListIcon = ({
  category,
  accent
}: {
  category: DeviceCategory;
  accent: string;
}) => {
  if (category === 'switch') {
    return (
      <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="#1e3a8a"
          stroke={accent}
          strokeWidth="2"
        />
        <rect x="11" y="17" width="18" height="6" rx="2" fill={accent} />
        <rect x="13" y="18" width="3" height="4" fill="#0b1f38" />
        <rect x="18.5" y="18" width="3" height="4" fill="#0b1f38" />
        <rect x="24" y="18" width="3" height="4" fill="#0b1f38" />
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
  const { availableDevices, fetchAvailableDevices, registerDevice, updateDevice, deleteDevice } = useRealtimeStore((state) => ({
    availableDevices: state.availableDevices,
    fetchAvailableDevices: state.fetchAvailableDevices,
    registerDevice: state.registerDevice,
    updateDevice: state.updateDevice,
    deleteDevice: state.deleteDevice
  }));
  const { elements, isDirty } = useCanvasStore((state) => ({
    elements: state.elements,
    isDirty: state.isDirty
  }));
  const { saveLayout, isSaving } = useLayoutStore((state) => ({
    saveLayout: state.saveLayout,
    isSaving: state.isSaving
  }));
  const addNotification = useUIStore((state) => state.addNotification);
  const [isLoading, setIsLoading] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; device: DeviceSummary } | null>(null);
  const [manualForm, setManualForm] = useState<ManualDeviceForm>({
    name: '',
    type: 'Camera',
    model: '',
    ip: '',
    bridgeRole: 'AP'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      setIsLoading(true);
      fetchAvailableDevices(projectId).finally(() => setIsLoading(false));
    }
  }, [fetchAvailableDevices, projectId]);

  const createNotificationId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const resolveUpdateErrorMessage = (error: unknown) => {
    const fallback = '更新设备失败，请稍后重试';
    const axiosError = error as AxiosError<{ message?: string | string[] }>;
    const status = axiosError?.response?.status;
    if (status === 409) {
      return '设备已在布局中，请先从画布中移除后再更新。';
    }
    const serverMessage = axiosError?.response?.data?.message;
    if (typeof serverMessage === 'string') {
      return serverMessage;
    }
    if (Array.isArray(serverMessage) && serverMessage.length > 0) {
      return serverMessage.join('；');
    }
    return fallback;
  };

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
    setManualForm({ name: '', type: 'Camera', model: '', ip: '', bridgeRole: 'AP' });
    setEditingDeviceId(null);
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
    const wasEditing = Boolean(editingDeviceId);
    if (isSaving) {
      setSubmitError('布局正在保存，请稍后再试。');
      return;
    }

    const trimmedName = manualForm.name.trim();
    const normalizedType = normalizeDeviceType(manualForm.type);
    const trimmedModel = manualForm.model.trim();
    const trimmedIp = manualForm.ip.trim();
    const requiresIp = normalizedType !== 'Switch';
    const requiresRole = normalizedType === 'Bridge';

    if (!normalizedType || !trimmedModel || (requiresIp && !trimmedIp)) {
      setSubmitError(requiresIp ? '请填写设备类型、设备型号与 IP 地址' : '请填写设备类型与设备型号');
      return;
    }

    if (requiresRole && !manualForm.bridgeRole) {
      setSubmitError('请选择网桥角色');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    if (editingDeviceId && isDirty) {
      const confirmed = window.confirm(
        '当前画布存在未保存的更改，本次更新将先保存布局再执行。是否继续？'
      );
      if (!confirmed) {
        setIsSubmitting(false);
        return;
      }
      try {
        await saveLayout();
      } catch (error) {
        console.error('更新设备前保存布局失败', error);
        setIsSubmitting(false);
        setSubmitError('保存布局失败，设备未更新。');
        addNotification({
          id: createNotificationId(),
          title: '更新设备已取消',
          message: '保存布局失败，设备未更新。',
          level: 'error'
        });
        return;
      }
    }

    const payload = {
      name: trimmedName,
      type: normalizedType,
      model: trimmedModel,
      ip: trimmedIp || undefined,
      bridgeRole: requiresRole ? manualForm.bridgeRole : undefined
    } as const;

    let result: DeviceSummary | null = null;

    if (editingDeviceId) {
      try {
        result = await updateDevice(projectId, editingDeviceId, payload);
      } catch (error) {
        const message = resolveUpdateErrorMessage(error);
        setSubmitError(message);
        addNotification({
          id: createNotificationId(),
          title: '更新设备失败',
          message,
          level: 'error'
        });
        setIsSubmitting(false);
        return;
      }
    } else {
      result = await registerDevice(projectId, payload);
      if (!result) {
        setSubmitError('设备创建失败，请稍后重试');
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);
    closeManualDialog();
    if (wasEditing) {
      addNotification({
        id: createNotificationId(),
        title: '设备已更新',
        message: '未布局设备信息已同步。',
        level: 'info'
      });
    }
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu]);

  const closeContextMenu = () => setContextMenu(null);

  const handleDeviceContextMenu = (event: MouseEvent<HTMLDivElement>, device: DeviceSummary) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, device });
  };

  const handleDeleteDevice = async () => {
    if (!contextMenu || !projectId) return;
    if (isSaving) {
      addNotification({
        id: createNotificationId(),
        title: '布局保存中',
        message: '请等待布局保存完成后再删除设备。',
        level: 'warning'
      });
      closeContextMenu();
      return;
    }
    const target = contextMenu;
    closeContextMenu();
    const requiresSave = isDirty;
    const confirmed = window.confirm(
      requiresSave
        ? '当前画布存在未保存的更改，本次删除将先保存布局再执行。是否继续？'
        : '确认删除该设备吗？删除后需重新添加。'
    );
    if (!confirmed) {
      return;
    }

    if (requiresSave) {
      try {
        await saveLayout();
      } catch (error) {
        console.error('删除设备前保存布局失败', error);
        addNotification({
          id: createNotificationId(),
          title: '删除设备已取消',
          message: '保存布局失败，设备未被删除。',
          level: 'error'
        });
        return;
      }
    }

    try {
      await deleteDevice(projectId, target.device.id);
      addNotification({
        id: createNotificationId(),
        title: '设备已删除',
        message: '设备已从未布局列表中移除。',
        level: 'info'
      });
    } catch (error) {
      console.error('删除设备失败', error);
      addNotification({
        id: createNotificationId(),
        title: '删除设备失败',
        message: '请检查网络后重试。',
        level: 'error'
      });
    }
  };

  const handleEditDevice = () => {
    if (!contextMenu) return;
    const device = contextMenu.device;
    const normalizedType = normalizeDeviceType(device.type);
    setManualForm({
      name: device.name ?? '',
      type: normalizedType,
      model: device.model ?? '',
      ip: device.ip ?? '',
      bridgeRole: normalizedType === 'Bridge' ? (device.bridgeRole === 'ST' ? 'ST' : 'AP') : 'AP'
    });
    setEditingDeviceId(device.id);
    setSubmitError(null);
    setIsSubmitting(false);
    setIsManualDialogOpen(true);
    closeContextMenu();
  };

  const contextMenuPosition = contextMenu
    ? (() => {
        if (typeof window === 'undefined') {
          return { top: contextMenu.y, left: contextMenu.x };
        }
        const top = Math.min(contextMenu.y, window.innerHeight - 96);
        const left = Math.min(contextMenu.x, window.innerWidth - 160);
        return { top, left };
      })()
    : null;

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
            onClick={() => {
              resetManualState();
              setIsManualDialogOpen(true);
            }}
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
                <DevicePaletteItem
                  device={device}
                  category={category}
                  status={status}
                  typeVisual={typeVisual}
                  deviceName={deviceName}
                  onDragStart={handleDragStart}
                  onContextMenu={handleDeviceContextMenu}
                />
              </li>
            );
          })}
        </ul>
      </div>
      {contextMenu && contextMenuPosition && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="fixed z-50 min-w-[140px] rounded-md border border-slate-700 bg-slate-900/95 py-1 text-sm text-slate-200 shadow-lg"
            style={{ top: contextMenuPosition.top, left: contextMenuPosition.left }}
          >
            <button
              type="button"
              onClick={handleEditDevice}
              className="block w-full px-3 py-2 text-left hover:bg-slate-800/80"
            >
              编辑
            </button>
            <button
              type="button"
              onClick={handleDeleteDevice}
              className="block w-full px-3 py-2 text-left text-rose-300 hover:bg-rose-900/40"
            >
              删除
            </button>
          </div>
        </>
      )}
      <ManualDeviceDialog
        open={isManualDialogOpen}
        onClose={closeManualDialog}
        form={manualForm}
        onChange={setManualForm}
        onSubmit={handleManualSubmit}
        isSubmitting={isSubmitting}
        errorMessage={submitError}
        mode={editingDeviceId ? 'edit' : 'create'}
      />
    </div>
  );
};

interface ManualDeviceDialogProps {
  open: boolean;
  onClose: () => void;
  form: ManualDeviceForm;
  onChange: (next: ManualDeviceForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  mode: 'create' | 'edit';
}

const MANUAL_DEVICE_TYPES = [
  { label: 'Camera', value: 'Camera' },
  { label: 'NVR', value: 'NVR' },
  { label: 'Bridge', value: 'Bridge' },
  { label: 'Switch', value: 'Switch' }
];

const normalizeDeviceType = (raw: string | undefined | null): ManualDeviceForm['type'] => {
  const normalized = (raw ?? '').trim().toLowerCase();
  switch (normalized) {
    case 'camera':
      return 'Camera';
    case 'nvr':
      return 'NVR';
    case 'bridge':
      return 'Bridge';
    case 'switch':
      return 'Switch';
    default:
      return 'Camera';
  }
};

const DevicePaletteItem = ({
  device,
  category,
  status,
  typeVisual,
  deviceName,
  onDragStart,
  onContextMenu
}: {
  device: DeviceSummary;
  category: DeviceCategory;
  status: ReturnType<typeof getStatusVisual>;
  typeVisual: ReturnType<typeof getDeviceTypeVisual>;
  deviceName: string;
  onDragStart: (event: DragEvent<HTMLDivElement>, device: DeviceSummary) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>, device: DeviceSummary) => void;
}) => {
  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, device)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(event, device);
      }}
      className="flex w-full cursor-grab items-center gap-2 rounded border px-2 py-2 text-left transition hover:ring-2 hover:ring-slate-100/60 active:cursor-grabbing"
      style={{
        backgroundColor: category === 'switch' ? '#1e3a8a' : status.nodeFill,
        borderColor: category === 'switch' ? '#38bdf8' : status.fill
      }}
    >
      <DeviceListIcon category={category} accent={status.textColor} />
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
              borderColor: category === 'switch' ? '#38bdf8' : typeVisual.accent,
              color: category === 'switch' ? '#dbeafe' : typeVisual.text,
              backgroundColor:
                category === 'switch' ? 'rgba(59, 130, 246, 0.2)' : typeVisual.background
            }}
          >
            {typeVisual.label}
          </span>
        </div>
        <div className="flex flex-col text-[11px]" style={{ color: status.secondaryTextColor }}>
          <span className="truncate">型号：{device.model?.trim() ? device.model : '—'}</span>
          <span className="truncate">IP：{device.ip ?? '待分配'}</span>
          {category === 'bridge' && (
            <span className="truncate">
              角色：{device.bridgeRole === 'AP' || device.bridgeRole === 'ST' ? device.bridgeRole : '未知'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const ManualDeviceDialog = ({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
  isSubmitting,
  errorMessage,
  mode
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
            <Dialog.Title className="text-lg font-semibold text-white">
              {mode === 'edit' ? '编辑设备' : '手动添加设备'}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-slate-400">
              {mode === 'edit'
                ? '更新设备基础信息并保持未布局列表同步。'
                : '填写设备基础信息，保存后可立即拖入画布完成布点。'}
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
                  onChange={(event) =>
                    onChange({
                      ...form,
                      type: event.target.value,
                      bridgeRole: event.target.value === 'Bridge' ? form.bridgeRole : 'AP'
                    })
                  }
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

              {form.type === 'Bridge' && (
                <fieldset className="flex flex-col gap-2">
                  <legend id="bridge-role-label" className="text-xs font-medium text-slate-300">
                    网桥角色 <span className="text-rose-300">*</span>
                  </legend>
                  <div className="flex gap-3" role="radiogroup" aria-labelledby="bridge-role-label">
                    {[
                      { value: 'AP' as const, label: 'AP（基站）' },
                      { value: 'ST' as const, label: 'ST（站点）' }
                    ].map((option) => (
                      <label
                        key={option.value}
                        className="inline-flex items-center gap-2 rounded border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-200"
                      >
                        <input
                          type="radio"
                          name="bridgeRole"
                          value={option.value}
                          checked={form.bridgeRole === option.value}
                          onChange={() => onChange({ ...form, bridgeRole: option.value })}
                          className="accent-brand-400"
                          required
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-500">AP 负责下发链路，ST 为接入站点。</span>
                </fieldset>
              )}

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
                  {isSubmitting ? '保存中...' : mode === 'edit' ? '更新设备' : '保存设备'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </Dialog>
  </Transition>
);
