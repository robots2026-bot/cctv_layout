import { Group } from 'react-konva';
import { memo, useEffect, useRef } from 'react';
import { CanvasElement } from '../../types/canvas';
import { useCanvasStore } from '../../stores/canvasStore';
import { shallow } from 'zustand/shallow';
import { DeviceNodeVisual } from './DeviceNodeVisual';

interface DeviceNodeProps {
  element: CanvasElement;
}

const DeviceNodeComponent = ({ element }: DeviceNodeProps) => {
  const groupRef = useRef<import('konva/lib/Group').Group>(null);
  const {
    hoveredElementId,
    setHoveredElement,
    openContextMenu,
    closeContextMenu,
    linking,
    cancelLinking,
    startLinking,
    completeLinking,
    mode,
    isLocked,
    updateElementPosition
  } = useCanvasStore(
    (state) => ({
      hoveredElementId: state.hoveredElementId,
      setHoveredElement: state.setHoveredElement,
      openContextMenu: state.openContextMenu,
      closeContextMenu: state.closeContextMenu,
      linking: state.linking,
      cancelLinking: state.cancelLinking,
      startLinking: state.startLinking,
      completeLinking: state.completeLinking,
      mode: state.mode,
      isLocked: state.isLocked,
      updateElementPosition: state.updateElementPosition
    }),
    shallow
  );
  const rafHandleRef = useRef<number | null>(null);
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
      }
      pendingPositionRef.current = null;
    },
    []
  );
  const isBlueprintEditing = mode === 'blueprint';
  const isHovered = hoveredElementId === element.id;
  const position = element.position ?? { x: 0, y: 0 };

  return (
    <Group
      x={position.x}
      y={position.y}
      draggable={mode === 'layout' && !linking.active && !isBlueprintEditing && !isLocked}
      listening={!isBlueprintEditing}
      ref={groupRef}
      onDragMove={(event) => {
        if (isBlueprintEditing || isLocked) {
          return;
        }
        pendingPositionRef.current = {
          x: event.target.x(),
          y: event.target.y()
        };
        if (rafHandleRef.current === null) {
          rafHandleRef.current = requestAnimationFrame(() => {
            rafHandleRef.current = null;
            const nextPosition = pendingPositionRef.current;
            if (!nextPosition) return;
            updateElementPosition(element.id, nextPosition);
            pendingPositionRef.current = null;
          });
        }
      }}
      onMouseEnter={() => {
        if (isBlueprintEditing) return;
        setHoveredElement(element.id);
        const stage = groupRef.current?.getStage();
        if (!stage) return;
        if (mode === 'layout' && !isLocked) {
          stage.container().style.cursor = 'grab';
        } else if (mode === 'linking' && !isLocked) {
          stage.container().style.cursor = 'pointer';
        } else {
          stage.container().style.cursor = 'default';
        }
      }}
      onMouseLeave={() => {
        if (isBlueprintEditing) return;
        setHoveredElement(null);
        const stage = groupRef.current?.getStage();
        if (stage) {
          stage.container().style.cursor = 'grab';
        }
      }}
      onMouseDown={(event) => {
        if (isBlueprintEditing || isLocked) {
          return;
        }
        if (mode !== 'linking') {
          return;
        }
        if (linking.active && event.evt.button === 0) {
          const stage = event.target.getStage();
          const pointer = stage?.getPointerPosition();
          event.cancelBubble = true;
          if (!linking.fromElementId) {
            if (pointer) {
              startLinking(element.id, pointer);
            }
            return;
          }
          if (linking.fromElementId === element.id) {
            cancelLinking();
            return;
          }
          completeLinking(element.id);
          return;
        }
        if (linking.active && event.evt.button !== 0) {
          event.cancelBubble = true;
        }
      }}
      onMouseUp={(event) => {
        if (isBlueprintEditing || isLocked) {
          return;
        }
        const store = useCanvasStore.getState();
        if (!store.linking.active || !store.linking.fromElementId) {
          return;
        }
        event.cancelBubble = true;
        if (store.linking.fromElementId === element.id) {
          store.cancelLinking();
          return;
        }
        completeLinking(element.id);
      }}
      onDragStart={(event) => {
        if (isBlueprintEditing || isLocked) {
          event.cancelBubble = true;
          return;
        }
        if (mode !== 'layout') {
          event.cancelBubble = true;
          return;
        }
        closeContextMenu();
        event.target.moveToTop();
        event.target.getLayer()?.batchDraw();
      }}
      onDragEnd={(event) => {
        if (isBlueprintEditing || isLocked) {
          event.cancelBubble = true;
          return;
        }
        if (mode !== 'layout') {
          event.cancelBubble = true;
          return;
        }
        if (rafHandleRef.current !== null) {
          cancelAnimationFrame(rafHandleRef.current);
          rafHandleRef.current = null;
        }
        const finalPosition = {
          x: event.target.x(),
          y: event.target.y()
        };
        pendingPositionRef.current = null;
        updateElementPosition(element.id, finalPosition);
      }}
      onContextMenu={(event) => {
        if (isBlueprintEditing || isLocked) {
          return;
        }
        event.evt.preventDefault();
        if (linking.active || mode === 'view') {
          return;
        }
        const { clientX, clientY } = event.evt;
        setHoveredElement(element.id);
        openContextMenu(element.id, { x: clientX, y: clientY });
      }}
    >
      <DeviceNodeVisual
        element={element}
        isHovered={isHovered}
        isLinkingSource={linking.active && linking.fromElementId === element.id}
      />
    </Group>
  );
};

export const DeviceNode = memo(DeviceNodeComponent);
DeviceNode.displayName = 'DeviceNode';
