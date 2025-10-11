import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '../utils/apiClient';
import { DeviceSummary } from '../types/canvas';
import { useCanvasStore } from './canvasStore';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

type RealtimeEvent =
  | { event: 'device.update'; payload: DeviceSummary }
  | { event: 'presence.sync'; payload: { users: string[] } };

interface RealtimeState {
  connectionState: ConnectionState;
  availableDevices: DeviceSummary[];
  onlineUsers: string[];
  connect: () => void;
  disconnect: () => void;
  fetchAvailableDevices: (projectId: string) => Promise<void>;
  handleEvent: (message: RealtimeEvent) => void;
  consumeDevice: (deviceId: string) => void;
  restoreDevice: (device: DeviceSummary) => void;
}

let socket: WebSocket | null = null;

export const useRealtimeStore = create<RealtimeState>()(
  devtools((set) => ({
    connectionState: 'disconnected',
    availableDevices: [],
    onlineUsers: [],
    connect: () => {
      if (typeof window === 'undefined') {
        return;
      }
      if (socket && socket.readyState === WebSocket.OPEN) return;
      set({ connectionState: 'connecting' });
      const wsUrl = (import.meta.env.VITE_REALTIME_URL as string | undefined) ?? 'ws://localhost:3000/realtime';
      socket = new WebSocket(wsUrl);
      socket.onopen = () => set({ connectionState: 'connected' });
      socket.onclose = () => set({ connectionState: 'disconnected' });
      socket.onerror = () => set({ connectionState: 'disconnected' });
      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as RealtimeEvent;
          useRealtimeStore.getState().handleEvent(parsed);
        } catch (error) {
          console.error('解析实时消息失败', error);
        }
      };
    },
    disconnect: () => {
      socket?.close();
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
        default:
          break;
      }
    }
  }))
);
