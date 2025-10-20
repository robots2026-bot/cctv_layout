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
  | { event: 'device.remove'; payload: { id: string; mac: string | null } }
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
  updateDeviceName: (
    projectId: string,
    deviceId: string,
    payload: {
      name: string;
    }
  ) => Promise<DeviceSummary | null>;
  deleteDevice: (projectId: string, deviceId: string) => Promise<void>;
  handleEvent: (message: RealtimeEvent) => void;
  consumeDevice: (device: DeviceSummary) => void;
  restoreDevice: (device: DeviceSummary) => void;
  syncWithPlacedDevices: () => void;
}

let socket: Socket | null = null;

const getDeviceKey = (device: DeviceSummary): string => device.mac ?? device.id;
const getPlacedKeys = () =>
  new Set(
    useCanvasStore
      .getState()
      .elements.map((element) => element.deviceMac ?? element.deviceId)
      .filter(Boolean) as string[]
  );

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
        const placedKeys = getPlacedKeys();
        const filtered = response.data
          .map((device) => ({
            ...device,
            mac: device.mac ?? null,
            alias: device.alias ?? null
          }))
          .filter((device) => !placedKeys.has(getDeviceKey(device)));
        set({ availableDevices: filtered });
      } catch (error) {
        console.error('获取可用设备失败', error);
      }
    },
    updateDeviceName: async (projectId, deviceId, payload) => {
      try {
        const response = await apiClient.patch<DeviceSummary>(
          `/projects/${projectId}/devices/${deviceId}`,
          {
            name: payload.name
          }
        );
        const summary = response.data;
        const normalizedSummary: DeviceSummary = {
          ...summary,
          mac: summary.mac ?? null,
          alias: summary.alias ?? null
        };
        set((state) => ({
          availableDevices: state.availableDevices.map((device) =>
            getDeviceKey(device) === getDeviceKey(normalizedSummary) ? normalizedSummary : device
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
        set((state) => {
          const target = state.availableDevices.find((device) => device.id === deviceId);
          const key = target ? getDeviceKey(target) : null;
          return {
            availableDevices: state.availableDevices.filter((device) => {
              if (!key) {
                return device.id !== deviceId;
              }
              return getDeviceKey(device) !== key;
            })
          };
        });
      } catch (error) {
        console.error('删除设备失败', error);
        throw error;
      }
    },
    consumeDevice: (device) => {
      const key = getDeviceKey(device);
      set((state) => ({
        availableDevices: state.availableDevices.filter(
          (item) => getDeviceKey(item) !== key
        )
      }));
    },
    restoreDevice: (device) => {
      set((state) => {
        const exists = state.availableDevices.some(
          (item) => getDeviceKey(item) === getDeviceKey(device)
        );
        if (exists) {
          return {
            availableDevices: state.availableDevices.map((item) =>
              getDeviceKey(item) === getDeviceKey(device)
                ? { ...item, ...device, alias: device.alias ?? null }
                : item
            )
          };
        }
        return {
          availableDevices: [...state.availableDevices, { ...device, alias: device.alias ?? null }]
        };
      });
    },
    syncWithPlacedDevices: () => {
      set((state) => {
        const placedKeys = getPlacedKeys();
        const filtered = state.availableDevices.filter(
          (device) => !placedKeys.has(getDeviceKey(device))
        );
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
            const placedKeys = getPlacedKeys();
            const normalized: DeviceSummary = {
              ...message.payload,
              mac: message.payload.mac ?? null,
              alias: message.payload.alias ?? null
            };
            if (placedKeys.has(getDeviceKey(normalized))) {
              return {};
            }
            const exists = state.availableDevices.some(
              (device) => getDeviceKey(device) === getDeviceKey(normalized)
            );
            const availableDevices = exists
              ? state.availableDevices.map((device) =>
                  getDeviceKey(device) === getDeviceKey(normalized)
                    ? { ...device, ...normalized }
                    : device
                )
              : [...state.availableDevices, normalized];
            return { availableDevices };
          });
          break;
        }
        case 'device.remove': {
          set((state) => ({
            availableDevices: state.availableDevices.filter(
              (device) => device.id !== message.payload.id && device.mac !== message.payload.mac
            )
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
