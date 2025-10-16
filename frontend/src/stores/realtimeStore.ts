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
    payload: { name?: string; type: string; ip: string; model: string; status?: DeviceSummary['status'] }
  ) => Promise<DeviceSummary | null>;
  handleEvent: (message: RealtimeEvent) => void;
  consumeDevice: (deviceId: string) => void;
  restoreDevice: (device: DeviceSummary) => void;
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
        const normalizedIp = payload.ip.trim();
        const normalizedModel = payload.model.trim();

        if (!normalizedType || !normalizedIp || !normalizedModel) {
          throw new Error('设备类型、IP 地址与设备型号不能为空');
        }

        const fallbackName = normalizedName || `${normalizedType}-${normalizedIp}`;

        const response = await apiClient.post(`/projects/${projectId}/devices/register`, {
          name: fallbackName,
          type: normalizedType,
          ipAddress: normalizedIp,
          model: normalizedModel,
          status: desiredStatus ?? 'unknown'
        });
        const device = response.data as {
          id: string;
          name: string;
          type: string;
          ipAddress?: string | null;
          status?: string | null;
          metadata?: { model?: string | null };
        };

        const summary: DeviceSummary = {
          id: device.id,
          name: device.name,
          type: device.type,
          ip: device.ipAddress ?? undefined,
          model: device.metadata?.model ?? undefined,
          status: (device.status as DeviceSummary['status']) ?? 'unknown'
        };

        set((state) => ({
          availableDevices: state.availableDevices.some((item) => item.id === summary.id)
            ? state.availableDevices.map((item) => (item.id === summary.id ? summary : item))
            : [...state.availableDevices, summary]
        }));

        return summary;
      } catch (error) {
        console.error('手动注册设备失败', error);
        return null;
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
