import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useCanvasStore } from './canvasStore';
interface Notification {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error';
}

type BlueprintMode = 'idle' | 'editing' | 'locked';

interface AliasDialogConfig {
  isOpen: boolean;
  title: string;
  confirmLabel: string;
  placeholder?: string;
  initialValue: string;
  description?: string;
  onConfirm?: (value: string) => Promise<void> | void;
}

interface UIState {
  notifications: Notification[];
  isProjectSidebarCollapsed: boolean;
  isDevicePanelCollapsed: boolean;
  blueprintMode: BlueprintMode;
  addNotification: (notification: Notification) => void;
  dismissNotification: (id: string) => void;
  toggleProjectSidebar: () => void;
  toggleDevicePanel: () => void;
  enterBlueprintMode: () => void;
  confirmBlueprintMode: () => void;
  exitBlueprintMode: () => void;
  aliasDialog: AliasDialogConfig;
  aliasDialogSubmitting: boolean;
  openAliasDialog: (config: Omit<AliasDialogConfig, 'isOpen'>) => void;
  closeAliasDialog: () => void;
  setAliasDialogSubmitting: (submitting: boolean) => void;
}

export const useUIStore = create<UIState>()(
  devtools((set) => ({
    notifications: [],
    isProjectSidebarCollapsed: false,
    isDevicePanelCollapsed: false,
    blueprintMode: 'idle',
    aliasDialog: {
      isOpen: false,
      title: '编辑别名',
      confirmLabel: '保存',
      initialValue: ''
    },
    aliasDialogSubmitting: false,
    addNotification: (notification) =>
      set((state) => ({ notifications: [notification, ...state.notifications].slice(0, 20) })),
    dismissNotification: (id) =>
      set((state) => ({ notifications: state.notifications.filter((notification) => notification.id !== id) })),
    toggleProjectSidebar: () =>
      set((state) => ({ isProjectSidebarCollapsed: !state.isProjectSidebarCollapsed })),
    toggleDevicePanel: () =>
      set((state) => ({ isDevicePanelCollapsed: !state.isDevicePanelCollapsed })),
    enterBlueprintMode: () => {
      const canvasStore = useCanvasStore.getState();
      canvasStore.cancelLinking();
      canvasStore.closeContextMenu();
      canvasStore.selectConnection(null);
      canvasStore.selectElement('');
      canvasStore.setHoveredElement(null);
      canvasStore.setMode('view');
      set({ blueprintMode: 'editing' });
    },
    confirmBlueprintMode: () =>
      set(() => ({
        blueprintMode: useCanvasStore.getState().blueprint ? 'locked' : 'idle'
      })),
    exitBlueprintMode: () => set({ blueprintMode: 'idle' }),
    openAliasDialog: (config) =>
      set({
        aliasDialog: {
          ...config,
          isOpen: true
        },
        aliasDialogSubmitting: false
      }),
    closeAliasDialog: () =>
      set({
        aliasDialog: {
          isOpen: false,
          title: '编辑别名',
          confirmLabel: '保存',
          initialValue: ''
        },
        aliasDialogSubmitting: false
      }),
    setAliasDialogSubmitting: (submitting) => set({ aliasDialogSubmitting: submitting })
  }))
);
