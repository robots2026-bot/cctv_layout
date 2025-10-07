import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { CanvasConnection, CanvasElement, CanvasLayout, CanvasViewport, DeviceSummary } from '../types/canvas';
import { nanoid } from '../utils/nanoid';

interface CanvasBackground {
  url: string | null;
  opacity: number;
}

interface CanvasState {
  elements: CanvasElement[];
  connections: CanvasConnection[];
  selectedElement: CanvasElement | null;
  background: CanvasBackground | null;
  viewport: CanvasViewport;
  gridSize: number;
  setViewport: (viewport: Partial<CanvasViewport>) => void;
  setBackground: (background: CanvasBackground | null) => void;
  setCanvasData: (layout: CanvasLayout) => void;
  addDeviceToCanvas: (device: DeviceSummary) => void;
  selectElement: (elementId: string) => void;
  updateElementPosition: (elementId: string, position: CanvasElement['position']) => void;
  updateElementMetadata: (elementId: string, updates: Partial<CanvasElement>) => void;
  resetCanvas: () => void;
}

const defaultViewport: CanvasViewport = {
  width: 1200,
  height: 800,
  scale: 1,
  position: { x: 0, y: 0 }
};

export const useCanvasStore = create<CanvasState>()(
  devtools((set) => ({
    elements: [],
    connections: [],
    selectedElement: null,
    background: null,
    gridSize: 48,
    viewport: defaultViewport,
    setViewport: (viewport) =>
      set((state) => ({
        viewport: {
          ...state.viewport,
          ...viewport,
          scale:
            viewport.scale !== undefined
              ? Math.min(4, Math.max(0.2, viewport.scale))
              : state.viewport.scale,
          position:
            viewport.position !== undefined
              ? viewport.position
              : state.viewport.position
        }
      })),
    setBackground: (background) => set({ background }),
    setCanvasData: (layout) =>
      set({
        elements: layout.elements.map((element) => ({ ...element, selected: false })),
        connections: layout.connections,
        background: layout.background
          ? { url: layout.background.url, opacity: layout.background.opacity }
          : null,
        selectedElement: null
      }),
    addDeviceToCanvas: (device) =>
      set((state) => {
        const newElement: CanvasElement = {
          id: nanoid(),
          name: device.name,
          type: device.type,
          metadata: { ip: device.ip },
          position: { x: 50, y: 50 },
          size: { width: 150, height: 70 },
          selected: true
        };
        return {
          elements: state.elements.map((element) => ({ ...element, selected: false })).concat(newElement),
          selectedElement: newElement
        };
      }),
    selectElement: (elementId) =>
      set((state) => {
        const nextElements = state.elements.map((element) => ({
          ...element,
          selected: element.id === elementId
        }));
        return {
          elements: nextElements,
          selectedElement: nextElements.find((element) => element.id === elementId) ?? null
        };
      }),
    updateElementPosition: (elementId, position) =>
      set((state) => ({
        elements: state.elements.map((element) =>
          element.id === elementId
            ? {
                ...element,
                position
              }
            : element
        ),
        selectedElement:
          state.selectedElement?.id === elementId
            ? { ...state.selectedElement, position }
            : state.selectedElement
      })),
    updateElementMetadata: (elementId, updates) =>
      set((state) => ({
        elements: state.elements.map((element) =>
          element.id === elementId
            ? {
                ...element,
                ...updates,
                metadata: {
                  ...element.metadata,
                  ...updates.metadata
                }
              }
            : element
        ),
        selectedElement:
          state.selectedElement?.id === elementId
            ? {
                ...state.selectedElement,
                ...updates,
                metadata: {
                  ...state.selectedElement.metadata,
                  ...updates.metadata
                }
              }
            : state.selectedElement
      })),
    resetCanvas: () =>
      set({
        elements: [],
        connections: [],
        selectedElement: null,
        background: null,
        viewport: defaultViewport
      })
  }))
);
