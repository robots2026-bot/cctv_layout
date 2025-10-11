import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface Notification {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error';
}

interface UIState {
  notifications: Notification[];
  isProjectSidebarCollapsed: boolean;
  isDevicePanelCollapsed: boolean;
  addNotification: (notification: Notification) => void;
  dismissNotification: (id: string) => void;
  toggleProjectSidebar: () => void;
  toggleDevicePanel: () => void;
}

export const useUIStore = create<UIState>()(
  devtools((set) => ({
    notifications: [],
    isProjectSidebarCollapsed: false,
    isDevicePanelCollapsed: false,
    addNotification: (notification) =>
      set((state) => ({ notifications: [notification, ...state.notifications].slice(0, 20) })),
    dismissNotification: (id) =>
      set((state) => ({ notifications: state.notifications.filter((notification) => notification.id !== id) })),
    toggleProjectSidebar: () =>
      set((state) => ({ isProjectSidebarCollapsed: !state.isProjectSidebarCollapsed })),
    toggleDevicePanel: () =>
      set((state) => ({ isDevicePanelCollapsed: !state.isDevicePanelCollapsed }))
  }))
);
