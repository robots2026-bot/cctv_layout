import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '../utils/apiClient';
import { CanvasLayout } from '../types/canvas';
import { useCanvasStore } from './canvasStore';

interface LayoutState {
  layout: CanvasLayout | null;
  isLoading: boolean;
  loadLayout: (layoutId: string) => Promise<void>;
  updateBackgroundOpacity: (opacity: number) => void;
}

export const useLayoutStore = create<LayoutState>()(
  devtools((set) => ({
    layout: null,
    isLoading: false,
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
    updateBackgroundOpacity: (opacity: number) => {
      set((state) => {
        if (!state.layout) return state;
        const updated: CanvasLayout = {
          ...state.layout,
          backgroundOpacity: opacity,
          background: state.layout.background
            ? { ...state.layout.background, opacity }
            : state.layout.background
        };
        useCanvasStore.getState().setBackground(
          updated.background ? { url: updated.background.url, opacity } : null
        );
        return { layout: updated };
      });
    }
  }))
);
