import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '../utils/apiClient';
import { DeviceSummary } from '../types/canvas';
import { useCanvasStore } from './canvasStore';
import { useProjectStore } from './projectStore';
import { useProjectManagementStore } from './projectManagementStore';
import { resolveBridgeRole } from '../utils/bridgeRole';

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
  registerSwitch: (
    projectId: string,
    payload: {
      name: string;
    }
  ) => Promise<DeviceSummary | null>;
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
          .map((device) => {
            const metadata = (device.metadata ?? null) as Record<string, unknown> | null;
            const bridgeRole =
              device.bridgeRole ??
              (device.type === 'Bridge'
                ? resolveBridgeRole(metadata ?? undefined, device.name)
                : 'UNKNOWN');
            return {
              ...device,
              mac: device.mac ?? null,
              alias: device.alias ?? null,
              metadata,
              bridgeRole
            };
          })
          .filter((device) => !placedKeys.has(getDeviceKey(device)));
        set({ availableDevices: filtered });
      } catch (error) {
        console.error('获取可用设备失败', error);
      }
    },
    registerSwitch: async (projectId, payload) => {
      try {
        const normalizedName = payload.name.trim();
        if (!normalizedName) {
          throw new Error('请填写交换机名称');
        }

        const response = await apiClient.post<DeviceSummary>(
          `/projects/${projectId}/devices/register-switch`,
          {
            name: normalizedName
          }
        );
        const summary = response.data;
        const metadata = (summary.metadata ?? null) as Record<string, unknown> | null;
        const bridgeRole =
          summary.bridgeRole ??
          (summary.type === 'Bridge'
            ? resolveBridgeRole(metadata ?? undefined, summary.name)
            : 'UNKNOWN');
        const normalizedSummary: DeviceSummary = {
          ...summary,
          mac: summary.mac ?? null,
          alias: summary.alias ?? null,
          metadata,
          bridgeRole
        };

        set((state) => ({
          availableDevices: state.availableDevices.some(
            (item) => getDeviceKey(item) === getDeviceKey(normalizedSummary)
          )
            ? state.availableDevices.map((item) =>
                getDeviceKey(item) === getDeviceKey(normalizedSummary)
                  ? normalizedSummary
                  : item
              )
            : [...state.availableDevices, normalizedSummary]
        }));

        return normalizedSummary;
      } catch (error) {
        console.error('手动创建交换机失败', error);
        return null;
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
        const metadata = (summary.metadata ?? null) as Record<string, unknown> | null;
        const bridgeRole =
          summary.bridgeRole ??
          (summary.type === 'Bridge'
            ? resolveBridgeRole(metadata ?? undefined, summary.name)
            : 'UNKNOWN');
        const normalizedSummary: DeviceSummary = {
          ...summary,
          mac: summary.mac ?? null,
          alias: summary.alias ?? null,
          metadata,
          bridgeRole
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
        const metadata = (device.metadata ?? null) as Record<string, unknown> | null;
        const bridgeRole =
          device.bridgeRole ??
          (device.type === 'Bridge'
            ? resolveBridgeRole(metadata ?? undefined, device.name)
            : 'UNKNOWN');
        const normalized: DeviceSummary = {
          ...device,
          mac: device.mac ?? null,
          alias: device.alias ?? null,
          metadata,
          bridgeRole
        };
        const exists = state.availableDevices.some(
          (item) => getDeviceKey(item) === getDeviceKey(normalized)
        );
        if (exists) {
          return {
            availableDevices: state.availableDevices.map((item) =>
              getDeviceKey(item) === getDeviceKey(normalized)
                ? normalized
                : item
            )
          };
        }
        return {
          availableDevices: [...state.availableDevices, normalized]
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
            const metadata = (message.payload.metadata ?? null) as Record<string, unknown> | null;
            const bridgeRole =
              message.payload.bridgeRole ??
              (message.payload.type === 'Bridge'
                ? resolveBridgeRole(metadata ?? undefined, message.payload.name)
                : 'UNKNOWN');
            const normalized: DeviceSummary = {
              ...message.payload,
              mac: message.payload.mac ?? null,
              alias: message.payload.alias ?? null,
              metadata,
              bridgeRole
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
