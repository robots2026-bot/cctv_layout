import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  CanvasBlueprint,
  CanvasConnection,
  CanvasElement,
  CanvasLayout,
  CanvasViewport,
  DeviceSummary
} from '../types/canvas';
import { nanoid } from '../utils/nanoid';
import { useRealtimeStore } from './realtimeStore';
import { getDeviceCategory } from '../utils/deviceVisual';

interface CanvasBackground {
  url: string | null;
}

interface CanvasContextMenu {
  elementId: string | null;
  position: { x: number; y: number };
}

interface LinkingState {
  active: boolean;
  fromElementId: string | null;
  pointer: { x: number; y: number } | null;
}

export type CanvasMode = 'view' | 'layout' | 'linking' | 'blueprint';

interface CanvasState {
  elements: CanvasElement[];
  connections: CanvasConnection[];
  selectedElement: CanvasElement | null;
  selectedConnectionId: string | null;
  hoveredElementId: string | null;
  contextMenu: CanvasContextMenu | null;
  linking: LinkingState;
  mode: CanvasMode;
  background: CanvasBackground | null;
  blueprint: CanvasBlueprint | null;
  viewport: CanvasViewport;
  gridSize: number;
  isLocked: boolean;
  isDirty: boolean;
  lastSavedAt?: number;
  setViewport: (viewport: Partial<CanvasViewport>) => void;
  setBackground: (background: CanvasBackground | null) => void;
  setBlueprint: (blueprint: CanvasBlueprint | null) => void;
  updateBlueprint: (patch: Partial<CanvasBlueprint>) => void;
  setCanvasData: (layout: CanvasLayout) => void;
  addDeviceToCanvas: (device: DeviceSummary, position?: CanvasElement['position']) => void;
  selectElement: (elementId: string) => void;
  selectConnection: (connectionId: string | null) => void;
  updateElementPosition: (elementId: string, position: CanvasElement['position']) => void;
  updateElementMetadata: (elementId: string, updates: Partial<CanvasElement>) => void;
  setHoveredElement: (elementId: string | null) => void;
  openContextMenu: (elementId: string, position: { x: number; y: number }) => void;
  closeContextMenu: () => void;
  setMode: (mode: CanvasMode) => void;
  setLinkingActive: (active: boolean) => void;
  startLinking: (elementId: string, pointer: { x: number; y: number }) => void;
  updateLinkingPointer: (pointer: { x: number; y: number }) => void;
  cancelLinking: () => void;
  completeLinking: (elementId: string) => void;
  addConnection: (fromElementId: string, toElementId: string) => void;
  removeConnection: (connectionId: string) => void;
  removeElement: (elementId: string) => void;
  resetCanvas: () => void;
  setLocked: (locked: boolean) => void;
  toggleLocked: () => void;
  focusAllElements: () => void;
  markDirty: () => void;
  markSaved: () => void;
}

const defaultViewport: CanvasViewport = {
  width: 1200,
  height: 800,
  scale: 1,
  position: { x: 0, y: 0 }
};

const getElementKey = (element: CanvasElement): string => element.deviceId ?? element.id;

const buildCategoryLookup = (elements: CanvasElement[]) => {
  const lookup = new Map<string, ReturnType<typeof getDeviceCategory>>();
  elements.forEach((element) => {
    lookup.set(getElementKey(element), getDeviceCategory(element.type));
  });
  return lookup;
};

const listConnectionsFor = (connections: CanvasConnection[], key: string) =>
  connections.filter((connection) =>
    connection.fromDeviceId === key || connection.toDeviceId === key
  );

const resolveOtherKey = (connection: CanvasConnection, key: string) =>
  connection.fromDeviceId === key ? connection.toDeviceId : connection.fromDeviceId;

const createsCycle = (
  connections: CanvasConnection[],
  startKey: string,
  targetKey: string
) => {
  if (connections.length === 0) return false;
  const adjacency = new Map<string, Set<string>>();
  const ensure = (key: string) => {
    if (!key) return;
    if (!adjacency.has(key)) {
      adjacency.set(key, new Set());
    }
  };

  connections.forEach((connection) => {
    const fromKey = connection.fromDeviceId ?? connection.id;
    const toKey = connection.toDeviceId ?? connection.id;
    if (!fromKey || !toKey) return;
    ensure(fromKey);
    ensure(toKey);
    adjacency.get(fromKey)?.add(toKey);
    adjacency.get(toKey)?.add(fromKey);
  });

  ensure(startKey);
  ensure(targetKey);

  const visited = new Set<string>();
  const queue: string[] = [startKey];
  visited.add(startKey);

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === targetKey) {
      return true;
    }
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    });
  }

  return false;
};

const evaluateEndpointConstraints = (
  element: CanvasElement,
  other: CanvasElement,
  connections: CanvasConnection[],
  lookup: Map<string, ReturnType<typeof getDeviceCategory>>
): string | null => {
  const category = lookup.get(getElementKey(element)) ?? getDeviceCategory(element.type);
  const otherCategory = lookup.get(getElementKey(other)) ?? getDeviceCategory(other.type);
  const key = getElementKey(element);

  if (category === 'camera') {
    if (otherCategory === 'camera') {
      return '摄像机之间禁止连接';
    }
    if (otherCategory !== 'bridge' && otherCategory !== 'switch') {
      return '摄像机只能连接交换机或网桥';
    }
    const existing = listConnectionsFor(connections, key);
    if (existing.length >= 1) {
      return '摄像机仅允许一条连接';
    }
  }

  if (category === 'bridge') {
    const existing = listConnectionsFor(connections, key);
    let bridgeToBridgeCount = 0;
    let bridgeToOthersCount = 0;
    existing.forEach((connection) => {
      const otherKey = resolveOtherKey(connection, key);
      const otherCat = otherKey
        ? lookup.get(otherKey) ?? 'other'
        : 'other';
      if (otherCat === 'bridge') {
        bridgeToBridgeCount += 1;
      } else {
        bridgeToOthersCount += 1;
      }
    });

    if (otherCategory === 'bridge' && bridgeToBridgeCount >= 1) {
      return '网桥之间仅允许一条连接';
    }
    if (otherCategory !== 'bridge' && bridgeToOthersCount >= 1) {
      return '网桥对其他设备仅允许一条连接';
    }
  }

  return null;
};

const canEstablishConnection = (
  elements: CanvasElement[],
  connections: CanvasConnection[],
  fromElement: CanvasElement,
  toElement: CanvasElement
) => {
  const lookup = buildCategoryLookup(elements);
  const fromKey = getElementKey(fromElement);
  const toKey = getElementKey(toElement);
  if (createsCycle(connections, fromKey, toKey)) {
    return { allowed: false, reason: '连接将形成环路，已阻止' } as const;
  }
  const fromCheck = evaluateEndpointConstraints(fromElement, toElement, connections, lookup);
  if (fromCheck) {
    return { allowed: false, reason: fromCheck };
  }
  const toCheck = evaluateEndpointConstraints(toElement, fromElement, connections, lookup);
  if (toCheck) {
    return { allowed: false, reason: toCheck };
  }
  return { allowed: true as const };
};

export const useCanvasStore = create<CanvasState>()(
  devtools((set) => ({
    elements: [],
    connections: [],
    selectedElement: null,
    selectedConnectionId: null,
    hoveredElementId: null,
    mode: 'view',
    contextMenu: null,
    linking: { active: false, fromElementId: null, pointer: null },
    background: null,
    blueprint: null,
    gridSize: 48,
    viewport: defaultViewport,
    isLocked: true,
    isDirty: false,
    lastSavedAt: undefined,
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
    setBackground: (background) => set({ background, isDirty: true }),
    setBlueprint: (blueprint) => set({ blueprint, isDirty: true }),
    updateBlueprint: (patch) =>
      set((state) => {
        if (!state.blueprint) {
          return { blueprint: state.blueprint };
        }
        const nextOffset =
          patch.offset !== undefined
            ? {
                x: patch.offset.x ?? state.blueprint.offset.x,
                y: patch.offset.y ?? state.blueprint.offset.y
              }
            : state.blueprint.offset;
        const nextBlueprint: CanvasBlueprint = {
          ...state.blueprint,
          ...patch,
          offset: nextOffset
        };
        return { blueprint: nextBlueprint, isDirty: true };
      }),
    setCanvasData: (layout) => {
      set({
        elements: layout.elements
          .filter((item): item is CanvasElement => Boolean(item) && !Array.isArray(item))
          .map((element) => ({
            ...element,
            metadata: element.metadata ?? {},
            position: element.position ?? { x: 0, y: 0 },
            size: element.size ?? { width: 150, height: 70 },
            selected: false
          })),
        connections: layout.connections
          .filter((item): item is CanvasConnection => Boolean(item) && !Array.isArray(item))
          .map((connection) => ({
            ...connection,
            from: connection.from ?? { x: 0, y: 0 },
            to: connection.to ?? { x: 0, y: 0 },
            bandwidth: connection.bandwidth ?? {},
            status: connection.status ?? 'online',
            selected: false
          })),
        background: layout.background ? { url: layout.background.url } : null,
        blueprint: layout.blueprint ?? null,
        selectedElement: null,
        selectedConnectionId: null,
        hoveredElementId: null,
        contextMenu: null,
        linking: { active: false, fromElementId: null, pointer: null },
        mode: 'view',
        isLocked: true,
        isDirty: false,
        lastSavedAt: Date.now()
      });
      useRealtimeStore.getState().syncWithPlacedDevices();
    },
    addDeviceToCanvas: (device, position) => {
      set((state) => {
        const newElement: CanvasElement = {
          id: nanoid(),
          name: device.name,
          type: device.type,
          deviceId: device.id,
          metadata: {
            ip: device.ip,
            status: device.status,
            model: device.model,
            sourceDeviceId: device.id
          },
          position: position ?? { x: 50, y: 50 },
          size: { width: 150, height: 70 },
          selected: false
        };
        return {
          elements: state.elements.map((element) => ({ ...element, selected: false })).concat(newElement),
          selectedElement: null,
          selectedConnectionId: null,
          hoveredElementId: newElement.id,
          contextMenu: null,
          linking: { active: false, fromElementId: null, pointer: null },
          isDirty: true
        };
      });
      useRealtimeStore.getState().syncWithPlacedDevices();
    },
    selectElement: (elementId) =>
      set((state) => {
        const nextElements = state.elements.map((element) => ({
          ...element,
          selected: element.id === elementId
        }));
        return {
          elements: nextElements,
          selectedElement: nextElements.find((element) => element.id === elementId) ?? null,
          selectedConnectionId: null
        };
      }),
    selectConnection: (connectionId) =>
      set((state) => ({
        connections: state.connections.map((connection) => ({
          ...connection,
          selected: connection.id === connectionId
        })),
        selectedConnectionId: connectionId,
        selectedElement: connectionId ? null : state.selectedElement
      })),
    updateElementPosition: (elementId, position) =>
      set((state) => {
        const updatedElements = state.elements.map((element) =>
          element.id === elementId
            ? {
                ...element,
                position
              }
            : element
        );
        const targetElement = updatedElements.find((element) => element.id === elementId);
        const targetKeys = targetElement
          ? [targetElement.deviceId ?? targetElement.id, targetElement.id]
          : [];
        const center = targetElement
          ? {
              x: targetElement.position.x + targetElement.size.width / 2,
              y: targetElement.position.y + targetElement.size.height / 2
            }
          : null;
        const updatedConnections = center
          ? state.connections.map((connection) => {
              const fromKey = connection.fromDeviceId ?? connection.id;
              const toKey = connection.toDeviceId ?? connection.id;
              if (targetKeys.includes(fromKey) && !targetKeys.includes(toKey)) {
                return {
                  ...connection,
                  from: center
                };
              }
              if (targetKeys.includes(toKey) && !targetKeys.includes(fromKey)) {
                return {
                  ...connection,
                  to: center
                };
              }
              if (targetKeys.includes(fromKey) && targetKeys.includes(toKey)) {
                return {
                  ...connection,
                  from: center,
                  to: center
                };
              }
              return connection;
            })
          : state.connections;
        return {
          elements: updatedElements,
          connections: updatedConnections,
          selectedElement:
            state.selectedElement?.id === elementId
              ? { ...state.selectedElement, position }
              : state.selectedElement,
          isDirty: true
        };
      }),
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
          : state.selectedElement,
        isDirty: true
      })),
    setHoveredElement: (elementId) =>
      set(() => ({
        hoveredElementId: elementId
      })),
    openContextMenu: (elementId, position) =>
      set(() => {
        const menuWidth = 160;
        const menuHeight = 48;
        let x = position.x;
        let y = position.y;
        if (typeof window !== 'undefined') {
          x = Math.min(x, window.innerWidth - menuWidth - 8);
          y = Math.min(y, window.innerHeight - menuHeight - 8);
        }
        return {
          contextMenu: {
            elementId,
            position: { x, y }
          }
        };
      }),
    closeContextMenu: () => set({ contextMenu: null }),
    setMode: (mode) =>
      set((state) => {
        const linkingState = mode === 'linking'
          ? { active: true, fromElementId: null, pointer: null }
          : { active: false, fromElementId: null, pointer: null };
        const shouldClearSelection = mode === 'view' || mode === 'blueprint';
        return {
          mode,
          linking: linkingState,
          contextMenu: null,
          hoveredElementId: shouldClearSelection ? null : state.hoveredElementId,
          selectedElement: shouldClearSelection ? null : state.selectedElement,
          selectedConnectionId: shouldClearSelection ? null : state.selectedConnectionId
        };
      }),
    setLinkingActive: (active) =>
      set(() => ({
        linking: active
          ? { active: true, fromElementId: null, pointer: null }
          : { active: false, fromElementId: null, pointer: null },
        contextMenu: null
      })),
    startLinking: (elementId, pointer) =>
      set((state) => {
        if (!state.linking.active) {
          return state;
        }
        return {
          linking: {
            active: true,
            fromElementId: elementId,
            pointer
          },
          contextMenu: null
        };
      }),
    updateLinkingPointer: (pointer) =>
      set((state) =>
        state.linking.active && state.linking.fromElementId
          ? {
              linking: {
                ...state.linking,
                pointer
              }
            }
          : state
      ),
    cancelLinking: () =>
      set((state) =>
        state.linking.active
          ? {
              linking: { active: true, fromElementId: null, pointer: null }
            }
          : state
      ),
    addConnection: (fromElementId, toElementId) =>
      set((state) => {
        if (fromElementId === toElementId) {
          return {
            linking: { active: false, fromElementId: null, pointer: null }
          };
        }
        const fromElement = state.elements.find((element) => element.id === fromElementId);
        const toElement = state.elements.find((element) => element.id === toElementId);
        if (!fromElement || !toElement) {
          return {
            linking: { active: false, fromElementId: null, pointer: null }
          };
        }
        const fromDeviceKey = fromElement.deviceId ?? fromElement.id;
        const toDeviceKey = toElement.deviceId ?? toElement.id;
        const exists = state.connections.some((connection) => {
          const fromKey = connection.fromDeviceId ?? connection.id;
          const toKey = connection.toDeviceId ?? connection.id;
          return (
            (fromKey === fromDeviceKey && toKey === toDeviceKey) ||
            (fromKey === toDeviceKey && toKey === fromDeviceKey)
          );
        });
        if (exists) {
          return {
            linking: { active: true, fromElementId: null, pointer: null }
          };
        }
        const validation = canEstablishConnection(state.elements, state.connections, fromElement, toElement);
        if (!validation.allowed) {
          console.warn(validation.reason);
          return {
            linking: { active: true, fromElementId: null, pointer: null }
          };
        }
        const center = (element: CanvasElement) => ({
          x: element.position.x + element.size.width / 2,
          y: element.position.y + element.size.height / 2
        });
        const newConnection: CanvasConnection = {
          id: nanoid(),
          from: center(fromElement),
          to: center(toElement),
          kind: 'wired',
          fromDeviceId: fromDeviceKey,
          toDeviceId: toDeviceKey,
          status: 'online',
          bandwidth: {}
        };
        const nextLinking = state.linking.active
          ? { active: true, fromElementId: null, pointer: null }
          : state.linking;
        return {
          connections: state.connections.concat(newConnection),
          linking: nextLinking,
          isDirty: true
        };
      }),
    completeLinking: (elementId) =>
      set((state) => {
        if (!state.linking.active || !state.linking.fromElementId) {
          return state;
        }
        const fromId = state.linking.fromElementId;
        const toId = elementId;
        if (fromId === toId) {
          return {
            linking: { active: false, fromElementId: null, pointer: null }
          };
        }
        const fromElement = state.elements.find((element) => element.id === fromId);
        const toElement = state.elements.find((element) => element.id === toId);
        if (!fromElement || !toElement) {
          return {
            linking: { active: false, fromElementId: null, pointer: null }
          };
        }
        const fromDeviceKey = fromElement.deviceId ?? fromElement.id;
        const toDeviceKey = toElement.deviceId ?? toElement.id;
        const exists = state.connections.some((connection) => {
          const fromKey = connection.fromDeviceId ?? connection.id;
          const toKey = connection.toDeviceId ?? connection.id;
          return (
            (fromKey === fromDeviceKey && toKey === toDeviceKey) ||
            (fromKey === toDeviceKey && toKey === fromDeviceKey)
          );
        });
        if (exists) {
          return {
            linking: { active: true, fromElementId: null, pointer: null }
          };
        }
        const validation = canEstablishConnection(state.elements, state.connections, fromElement, toElement);
        if (!validation.allowed) {
          console.warn(validation.reason);
          return {
            linking: { active: true, fromElementId: null, pointer: null }
          };
        }
        const center = (element: CanvasElement) => ({
          x: element.position.x + element.size.width / 2,
          y: element.position.y + element.size.height / 2
        });
        const newConnection: CanvasConnection = {
          id: nanoid(),
          from: center(fromElement),
          to: center(toElement),
          kind: 'wired',
          fromDeviceId: fromDeviceKey,
          toDeviceId: toDeviceKey,
          status: 'online',
          bandwidth: {}
        };
        return {
          connections: state.connections.concat(newConnection),
          linking: { active: true, fromElementId: null, pointer: null },
          isDirty: true
        };
      }),
    removeConnection: (connectionId) =>
      set((state) => ({
        connections: state.connections.filter((connection) => connection.id !== connectionId),
        selectedConnectionId:
          state.selectedConnectionId === connectionId ? null : state.selectedConnectionId,
        contextMenu: null,
        isDirty: true
      })),
    removeElement: (elementId) => {
      set((state) => {
        const target = state.elements.find((element) => element.id === elementId);
        const targetKeys = target
          ? [target.deviceId ?? target.id, target.id]
          : [];
        if (target) {
          const restoreId = (target.metadata?.sourceDeviceId as string | undefined) ?? target.deviceId ?? target.id;
          if (restoreId) {
            const restored: DeviceSummary = {
              id: restoreId,
              name: target.name,
              type: target.type,
              ip: target.metadata?.ip as string | undefined,
              model: target.metadata?.model as string | undefined,
              status:
                (target.metadata?.status as DeviceSummary['status']) ??
                ('unknown' as DeviceSummary['status'])
            };
            useRealtimeStore.getState().restoreDevice(restored);
          }
        }
        return {
          elements: state.elements.filter((element) => element.id !== elementId),
          connections: state.connections.filter((connection) => {
            const fromKey = connection.fromDeviceId ?? connection.id;
            const toKey = connection.toDeviceId ?? connection.id;
            return !targetKeys.includes(fromKey) && !targetKeys.includes(toKey);
          }),
          selectedElement:
            state.selectedElement?.id === elementId ? null : state.selectedElement,
          selectedConnectionId: null,
          hoveredElementId: state.hoveredElementId === elementId ? null : state.hoveredElementId,
          contextMenu: null,
          linking: { active: false, fromElementId: null, pointer: null },
          isDirty: true
        };
      });
      useRealtimeStore.getState().syncWithPlacedDevices();
    },
    resetCanvas: () =>
      set({
        elements: [],
        connections: [],
        selectedElement: null,
        hoveredElementId: null,
        contextMenu: null,
        linking: { active: false, fromElementId: null, pointer: null },
        background: null,
        blueprint: null,
        viewport: defaultViewport,
        mode: 'view',
        isLocked: true,
        isDirty: false,
        lastSavedAt: Date.now()
      }),
    setLocked: (locked) => set({ isLocked: locked }),
    toggleLocked: () =>
      set((state) => ({
        isLocked: !state.isLocked
      })),
    focusAllElements: () =>
      set((state) => {
        const { elements, viewport } = state;
        if (!viewport.width || !viewport.height) {
          return {};
        }
        if (elements.length === 0) {
          return {
            viewport: {
              ...viewport,
              scale: 1,
              position: { x: 0, y: 0 }
            }
          };
        }
        const padding = 80;
        const minX = Math.min(...elements.map((element) => element.position.x));
        const minY = Math.min(...elements.map((element) => element.position.y));
        const maxX = Math.max(
          ...elements.map((element) => element.position.x + element.size.width)
        );
        const maxY = Math.max(
          ...elements.map((element) => element.position.y + element.size.height)
        );
        const contentWidth = Math.max(1, maxX - minX);
        const contentHeight = Math.max(1, maxY - minY);
        const availableWidth = Math.max(1, viewport.width - padding);
        const availableHeight = Math.max(1, viewport.height - padding);
        const scaleFactor = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
        const targetScale = Math.min(1, Math.min(4, Math.max(0.2, scaleFactor)));
        const centerX = minX + contentWidth / 2;
        const centerY = minY + contentHeight / 2;
        const position = {
          x: viewport.width / 2 - targetScale * centerX,
          y: viewport.height / 2 - targetScale * centerY
        };
        return {
          viewport: {
            ...viewport,
            scale: targetScale,
            position
          }
        };
      }),
    markDirty: () => set({ isDirty: true }),
    markSaved: () => set({ isDirty: false, lastSavedAt: Date.now() })
  }))
);
