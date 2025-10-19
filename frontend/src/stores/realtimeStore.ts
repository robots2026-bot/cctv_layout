import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '../utils/apiClient';
import { DeviceSummary } from '../types/canvas';
import { useCanvasStore } from './canvasStore';
import { useProjectStore } from './projectStore';
import { useProjectManagementStore } from './projectManagementStore';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

type RealtimeEvent =
  | { event: 'device.update'; payload: DeviceSummary }
  | { event: 'device.remove'; payload: { id: string } }
  | { event: 'presence.sync'; payload: { users: string[] } }
  | {
      event: 'projects.updated';
      payload: { projectId: string; action: 'created' | 'updated' | 'archived' | 'deleted' | 'restored' };
    };

interface RealtimeState {
  connectionState: ConnectionState;
  availableDevices: DeviceSummary[];
  onlineUsers: string[];
  connect: () => void;
  disconnect: () => void;
  fetchAvailableDevices: (projectId: string) => Promise<void>;
  registerDevice: (
    projectId: string,
    payload: {
      name?: string;
      type: string;
      ip?: string;
      model: string;
      status?: DeviceSummary['status'];
      bridgeRole?: 'AP' | 'ST';
    }
  ) => Promise<DeviceSummary | null>;
  updateDevice: (
    projectId: string,
    deviceId: string,
    payload: {
      name?: string;
      type?: string;
      ip?: string;
      model?: string;
      status?: DeviceSummary['status'];
      bridgeRole?: 'AP' | 'ST';
    }
  ) => Promise<DeviceSummary | null>;
  deleteDevice: (projectId: string, deviceId: string) => Promise<void>;
  handleEvent: (message: RealtimeEvent) => void;
  consumeDevice: (deviceId: string) => void;
  restoreDevice: (device: DeviceSummary) => void;
  syncWithPlacedDevices: () => void;
}

let socket: Socket | null = null;

export const useRealtimeStore = create<RealtimeState>()(
  devtools((set) => ({
    connectionState: 'disconnected',
    availableDevices: [],
    onlineUsers: [],
    connect: () => {
      if (typeof window === 'undefined') return;
      if (socket && socket.connected) return;

      const baseUrl =
        (import.meta.env.VITE_REALTIME_URL as string | undefined) ?? 'http://localhost:3000';

      set({ connectionState: 'connecting' });
      socket = io(baseUrl, {
        path: import.meta.env.VITE_REALTIME_PATH ?? '/realtime'
      });

      socket.on('connect', () => {
        set({ connectionState: 'connected' });
      });

      socket.on('disconnect', () => {
        set({ connectionState: 'disconnected' });
      });

      socket.on('connect_error', (error) => {
        console.error('实时连接失败', error);
        set({ connectionState: 'disconnected' });
      });

      socket.onAny((event, payload) => {
        if (!event) return;
        const message = { event, payload } as RealtimeEvent;
        useRealtimeStore.getState().handleEvent(message);
      });
    },
    disconnect: () => {
      socket?.removeAllListeners();
      socket?.disconnect();
      socket = null;
      set({ connectionState: 'disconnected' });
    },
    fetchAvailableDevices: async (projectId: string) => {
      try {
        const response = await apiClient.get<DeviceSummary[]>(`/projects/${projectId}/devices`);
        const placedIds = new Set(
          useCanvasStore
            .getState()
            .elements.map((element) => element.deviceId)
            .filter(Boolean) as string[]
        );
        const filtered = response.data.filter((device) => !placedIds.has(device.id));
        set({ availableDevices: filtered });
      } catch (error) {
        console.error('获取可用设备失败', error);
      }
    },
    registerDevice: async (projectId, payload) => {
      try {
        const desiredStatus =
          payload.status && payload.status !== 'warning' ? payload.status : undefined;
        const normalizedName = payload.name?.trim() ?? '';
        const normalizedType = payload.type.trim();
        const normalizedIp = payload.ip?.trim() ?? '';
        const normalizedModel = payload.model.trim();
        const requiresIp = normalizedType.toLowerCase() !== 'switch';
        const normalizedRole = payload.bridgeRole ? payload.bridgeRole.toUpperCase() : undefined;
        const requiresRole = normalizedType.toLowerCase() === 'bridge';

        if (!normalizedType || !normalizedModel || (requiresIp && !normalizedIp)) {
          throw new Error('请填写设备类型、型号，及必要时的 IP 地址');
        }

        if (requiresRole && (normalizedRole !== 'AP' && normalizedRole !== 'ST')) {
          throw new Error('网桥类型需要选择 AP 或 ST');
        }

        const fallbackName = normalizedName || (normalizedIp ? `${normalizedType}-${normalizedIp}` : `${normalizedType}-${normalizedModel || Date.now().toString(36)}`);

        const response = await apiClient.post<DeviceSummary>(`/projects/${projectId}/devices/register`, {
          name: fallbackName,
          type: normalizedType,
          ipAddress: normalizedIp || undefined,
          model: normalizedModel,
          status: desiredStatus ?? 'unknown',
          bridgeRole: normalizedRole
        });
        const summary = response.data;
        const normalizedSummary: DeviceSummary = {
          ...summary,
          bridgeRole: summary.bridgeRole ?? 'UNKNOWN'
        };

        set((state) => ({
          availableDevices: state.availableDevices.some((item) => item.id === normalizedSummary.id)
            ? state.availableDevices.map((item) =>
                item.id === normalizedSummary.id ? normalizedSummary : item
              )
            : [...state.availableDevices, normalizedSummary]
        }));

        return normalizedSummary;
      } catch (error) {
        console.error('手动注册设备失败', error);
        return null;
      }
    },
    updateDevice: async (projectId, deviceId, payload) => {
      try {
        const response = await apiClient.patch<DeviceSummary>(
          `/projects/${projectId}/devices/${deviceId}`,
          {
            name: payload.name,
            type: payload.type,
            ipAddress: payload.ip,
            model: payload.model,
            status: payload.status,
            bridgeRole: payload.bridgeRole
          }
        );
        const summary = response.data;
        const normalizedSummary: DeviceSummary = {
          ...summary,
          bridgeRole: summary.bridgeRole ?? 'UNKNOWN'
        };
        set((state) => ({
          availableDevices: state.availableDevices.map((device) =>
            device.id === normalizedSummary.id ? normalizedSummary : device
          )
        }));
        return normalizedSummary;
      } catch (error) {
        console.error('更新设备失败', error);
        throw error;
      }
    },
    deleteDevice: async (projectId, deviceId) => {
      try {
        await apiClient.delete(`/projects/${projectId}/devices/${deviceId}`);
        set((state) => ({
          availableDevices: state.availableDevices.filter((device) => device.id !== deviceId)
        }));
      } catch (error) {
        console.error('删除设备失败', error);
        throw error;
      }
    },
    consumeDevice: (deviceId: string) => {
      set((state) => ({
        availableDevices: state.availableDevices.filter((device) => device.id !== deviceId)
      }));
    },
    restoreDevice: (device) => {
      set((state) => {
        const exists = state.availableDevices.some((item) => item.id === device.id);
        if (exists) {
          return {
            availableDevices: state.availableDevices.map((item) =>
              item.id === device.id ? { ...item, ...device } : item
            )
          };
        }
        return {
          availableDevices: [...state.availableDevices, device]
        };
      });
    },
    syncWithPlacedDevices: () => {
      set((state) => {
        const placedIds = new Set(
          useCanvasStore
            .getState()
            .elements.map((element) => element.deviceId)
            .filter(Boolean) as string[]
        );
        const filtered = state.availableDevices.filter((device) => !placedIds.has(device.id));
        if (filtered.length === state.availableDevices.length) {
          return state.availableDevices === filtered ? {} : { availableDevices: filtered };
        }
        return { availableDevices: filtered };
      });
    },
    handleEvent: (message: RealtimeEvent) => {
      switch (message.event) {
        case 'device.update': {
          set((state) => {
            const placedIds = new Set(
              useCanvasStore
                .getState()
                .elements.map((element) => element.deviceId)
                .filter(Boolean) as string[]
            );
            if (placedIds.has(message.payload.id)) {
              return {};
            }
            const exists = state.availableDevices.some((device) => device.id === message.payload.id);
            const availableDevices = exists
              ? state.availableDevices.map((device) =>
                  device.id === message.payload.id ? { ...device, ...message.payload } : device
                )
              : [...state.availableDevices, message.payload];
            return { availableDevices };
          });
          break;
        }
        case 'device.remove': {
          set((state) => ({
            availableDevices: state.availableDevices.filter((device) => device.id !== message.payload.id)
          }));
          break;
        }
        case 'presence.sync': {
          set({ onlineUsers: message.payload.users });
          break;
        }
        case 'projects.updated': {
          void useProjectStore.getState().fetchProjects({ silent: true });
          void useProjectManagementStore.getState().fetchProjects();
          break;
        }
        default:
          break;
      }
    }
  }))
);
