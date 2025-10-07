import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '../utils/apiClient';
import { DeviceSummary } from '../types/canvas';

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
        set({ availableDevices: response.data });
      } catch (error) {
        console.error('获取可用设备失败', error);
      }
    },
    handleEvent: (message: RealtimeEvent) => {
      switch (message.event) {
        case 'device.update': {
          set((state) => {
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
