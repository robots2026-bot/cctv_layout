import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '../utils/apiClient';
import { CanvasConnection, CanvasElement, CanvasLayout } from '../types/canvas';
import { useCanvasStore } from './canvasStore';
import { useUIStore } from './uiStore';

interface LayoutState {
  layout: CanvasLayout | null;
  isLoading: boolean;
  loadLayout: (layoutId: string) => Promise<void>;
  isSaving: boolean;
  saveLayout: (layoutId?: string) => Promise<void>;
}

export const useLayoutStore = create<LayoutState>()(
  devtools((set, get) => ({
    layout: null,
    isLoading: false,
    isSaving: false,
    loadLayout: async (layoutId: string) => {
      set({ isLoading: true });
      try {
        const response = await apiClient.get<CanvasLayout>(`/layouts/${layoutId}`);
        set({ layout: response.data, isLoading: false });
        useCanvasStore.getState().setCanvasData(response.data);
      } catch (error) {
        console.error('加载布局失败', error);
        set({ isLoading: false });
      }
    },
    saveLayout: async (layoutId?: string) => {
      const targetLayoutId = layoutId ?? get().layout?.id;
      if (!targetLayoutId) {
        useUIStore.getState().addNotification({
          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          title: '无法保存布局',
          message: '未找到有效的布局 ID。',
          level: 'error'
        });
        return;
      }

      const canvasState = useCanvasStore.getState();
      const sanitizeElement = (element: CanvasElement) => ({
        id: element.id,
        name: element.name,
        type: element.type,
        deviceId: element.deviceId ?? null,
        metadata: element.metadata ?? {},
        position: element.position ?? { x: 0, y: 0 },
        size: element.size ?? { width: 150, height: 70 },
        selected: false
      });

      const sanitizeConnection = (connection: CanvasConnection) => ({
        id: connection.id,
        from: connection.from ?? { x: 0, y: 0 },
        to: connection.to ?? { x: 0, y: 0 },
        kind: connection.kind,
        fromDeviceId: connection.fromDeviceId ?? null,
        toDeviceId: connection.toDeviceId ?? null,
        bandwidth: connection.bandwidth ?? {},
        status: connection.status ?? 'online',
        selected: connection.selected ?? false
      });

      const serializeBlueprint = (blueprint: typeof canvasState.blueprint) => {
        if (!blueprint || typeof blueprint.url !== 'string' || !blueprint.url) {
          return null;
        }
        return {
          url: blueprint.url,
          naturalWidth: blueprint.naturalWidth,
          naturalHeight: blueprint.naturalHeight,
          scale: blueprint.scale,
          opacity: blueprint.opacity,
          offset: { ...blueprint.offset },
          fileId: blueprint.fileId ?? null
        };
      };

      const payload = {
        layoutId: targetLayoutId,
        elements: canvasState.elements.map(sanitizeElement),
        connections: canvasState.connections.map(sanitizeConnection),
        backgroundImageUrl: canvasState.background?.url ?? undefined,
        metadata: {
          blueprint: serializeBlueprint(canvasState.blueprint),
          viewport: canvasState.viewport
        }
      };

      set({ isSaving: true });
      try {
        await apiClient.post(`/layouts/${targetLayoutId}/versions`, payload);
        useCanvasStore.getState().markSaved();
        set({ isSaving: false });
        useUIStore.getState().addNotification({
          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          title: '布局已保存',
          message: '最新更改已生成布局版本。',
          level: 'info'
        });
      } catch (error) {
        console.error('保存布局失败', error);
        set({ isSaving: false });
        useUIStore.getState().addNotification({
          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          title: '保存布局失败',
          message: '请检查网络后重试。',
          level: 'error'
        });
        throw error;
      }
    }
  }))
);
