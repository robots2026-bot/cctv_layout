import type { AxiosError } from 'axios';
import { DragEvent, MouseEvent, useEffect, useMemo, useState } from 'react';
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
import { resolveBridgeRole } from '../../utils/bridgeRole';

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
  const { availableDevices, fetchAvailableDevices, registerSwitch, updateDeviceName, deleteDevice } = useRealtimeStore((state) => ({
    availableDevices: state.availableDevices,
    fetchAvailableDevices: state.fetchAvailableDevices,
    registerSwitch: state.registerSwitch,
    updateDeviceName: state.updateDeviceName,
    deleteDevice: state.deleteDevice
  }));
  const { elements, isDirty, mode } = useCanvasStore((state) => ({
    elements: state.elements,
    isDirty: state.isDirty,
    mode: state.mode
  }));
  const { saveLayout, isSaving } = useLayoutStore((state) => ({
    saveLayout: state.saveLayout,
    isSaving: state.isSaving
  }));
  const { addNotification, openAliasDialog } = useUIStore((state) => ({
    addNotification: state.addNotification,
    openAliasDialog: state.openAliasDialog
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; device: DeviceSummary } | null>(null);

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
    const fallback = '更新别名失败，请稍后重试';
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
    const placedCount = elements.filter((element) => Boolean(element.deviceId ?? element.deviceMac)).length;
    const unplaced = availableDevices.length;
    const placed = placedCount;
    const total = unplaced + placed;
    return {
      total,
      unplaced,
      placed
    };
  }, [availableDevices.length, elements]);

  const handleAddSwitch = () => {
    if (!projectId) return;
    if (isSaving) {
      addNotification({
        id: createNotificationId(),
        title: '布局保存中',
        message: '请等待布局保存完成后再手动添加交换机。',
        level: 'warning'
      });
      return;
    }

    openAliasDialog({
      title: '手动添加交换机',
      confirmLabel: '创建交换机',
      placeholder: '例如：施工区交换机01',
      initialValue: '',
      description: '填写交换机名称后，该设备会出现在未布局设备列表中。',
      onConfirm: async (name) => {
        const trimmed = name.trim();
        if (!trimmed) {
          throw new Error('请填写交换机名称');
        }
        try {
          await registerSwitch(projectId, { name: trimmed });
          addNotification({
            id: createNotificationId(),
            title: '交换机已创建',
            message: '新交换机已加入未布局设备列表。',
            level: 'info'
          });
        } catch (error) {
          const axiosError = error as AxiosError<{ message?: string | string[] }>;
          if (axiosError?.response?.status === 409) {
            throw new Error('同一项目内交换机名称已存在，请调整后重试。');
          }
          throw new Error('交换机创建失败，请稍后重试');
        }
      }
    });
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
        ? '当前画布存在未保存的更改，本次隐藏将先保存布局再执行。是否继续？'
        : '确认隐藏该设备吗？网关后续同步同一 MAC 时会自动恢复。'
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
        title: '设备已隐藏',
        message: '设备已从未布局列表中隐藏，后续同步可自动恢复。',
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
    if (!contextMenu || !projectId) return;
    const category = getDeviceCategory(contextMenu.device.type);
    if (category === 'switch') {
      return;
    }
    const device = contextMenu.device;
    openAliasDialog({
      title: '编辑设备别名',
      confirmLabel: '保存',
      initialValue: device.alias ?? device.name ?? '',
      onConfirm: async (nextName) => {
        if (isDirty) {
          const confirmed = window.confirm(
            '当前画布存在未保存的更改，本次更新将先保存布局再执行。是否继续？'
          );
          if (!confirmed) {
            return;
          }
          try {
            await saveLayout();
          } catch (error) {
            console.error('保存布局失败', error);
            throw new Error('保存布局失败，设备别名未更新。');
          }
        }
        try {
          await updateDeviceName(projectId, device.id, { name: nextName });
          addNotification({
            id: createNotificationId(),
            title: '别名已更新',
            message: `设备已更新为 “${nextName}”。`,
            level: 'info'
          });
        } catch (error) {
          console.error('更新设备失败', error);
          throw new Error(resolveUpdateErrorMessage(error));
        }
      }
    });
    setContextMenu(null);
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

  if (mode !== 'layout') {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800/80 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">未布局设备资源</h2>
            <p className="mt-1 text-xs text-slate-500">网关同步设备的基础信息，可手动添加交换机或维护别名。</p>
          </div>
          <button
            type="button"
            onClick={handleAddSwitch}
            disabled={!projectId}
            className="inline-flex items-center gap-1 rounded border border-brand-500/40 bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-200 transition hover:border-brand-400/70 hover:bg-brand-500/20 hover:text-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            手动添加交换机
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
            const metadata = (device.metadata ?? null) as Record<string, unknown> | null;
            const bridgeRole =
              category === 'bridge'
                ? device.bridgeRole && device.bridgeRole !== 'UNKNOWN'
                  ? device.bridgeRole
                  : resolveBridgeRole(metadata ?? undefined, device.name)
                : 'UNKNOWN';
            const alias = device.alias?.trim();
            const deviceName = category === 'switch'
              ? device.name?.trim() ?? typeVisual.label
              : alias && alias.length > 0
                ? alias
                : device.name?.trim()
                  ? device.name
                  : typeVisual.label;
            return (
              <li key={device.mac ?? device.id}>
                <DevicePaletteItem
                  device={device}
                  category={category}
                  status={status}
                  typeVisual={typeVisual}
                  deviceName={deviceName}
                  bridgeRole={bridgeRole}
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
            className="fixed z-50 min-w-[160px] rounded-md border border-slate-700 bg-slate-900/95 py-1 text-sm text-slate-200 shadow-lg"
            style={{ top: contextMenuPosition.top, left: contextMenuPosition.left }}
          >
            {getDeviceCategory(contextMenu.device.type) !== 'switch' && (
              <button
                type="button"
                onClick={handleEditDevice}
                className="block w-full px-3 py-2 text-left hover:bg-slate-800/80"
              >
                编辑别名
              </button>
            )}
            <button
              type="button"
              onClick={handleDeleteDevice}
              className="block w-full px-3 py-2 text-left text-rose-300 hover:bg-rose-900/40"
            >
              隐藏
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const DevicePaletteItem = ({
  device,
  category,
  status,
  typeVisual,
  deviceName,
  bridgeRole,
  onDragStart,
  onContextMenu
}: {
  device: DeviceSummary;
  category: DeviceCategory;
  status: ReturnType<typeof getStatusVisual>;
  typeVisual: ReturnType<typeof getDeviceTypeVisual>;
  deviceName: string;
  bridgeRole: 'AP' | 'ST' | 'UNKNOWN';
  onDragStart: (event: DragEvent<HTMLDivElement>, device: DeviceSummary) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>, device: DeviceSummary) => void;
}) => {
  const bridgeBadgeStyles =
    bridgeRole === 'AP'
      ? {
          borderColor: '#1d4ed8',
          color: '#dbeafe',
          backgroundColor: 'rgba(37, 99, 235, 0.18)'
        }
      : {
          borderColor: '#f97316',
          color: '#ffe6d5',
          backgroundColor: 'rgba(249, 115, 22, 0.18)'
        };

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
          <div className="flex shrink-0 items-center gap-1">
            {category === 'bridge' && bridgeRole !== 'UNKNOWN' && (
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={bridgeBadgeStyles}
              >
                {bridgeRole}
              </span>
            )}
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
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
        </div>
        <div className="flex flex-col text-[11px]" style={{ color: status.secondaryTextColor }}>
          <span className="truncate">MAC：{device.mac ? device.mac.toUpperCase() : '—'}</span>
          {category !== 'switch' && (
            <>
              <span className="truncate">型号：{device.model?.trim() ? device.model : '—'}</span>
              <span className="truncate">IP：{device.ip ?? '待分配'}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
