import { Circle, Group, Rect, Text } from 'react-konva';
import { CanvasElement } from '../../types/canvas';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';
import { getDeviceCategory, getStatusVisual } from '../../utils/deviceVisual';

interface DeviceNodeProps {
  element: CanvasElement;
}

export const DeviceNode = ({ element }: DeviceNodeProps) => {
  const {
    hoveredElementId,
    setHoveredElement,
    openContextMenu,
    closeContextMenu,
    linking,
    cancelLinking,
    startLinking,
    completeLinking,
    mode
  } = useCanvasStore((state) => ({
    hoveredElementId: state.hoveredElementId,
    setHoveredElement: state.setHoveredElement,
    openContextMenu: state.openContextMenu,
    closeContextMenu: state.closeContextMenu,
    linking: state.linking,
    cancelLinking: state.cancelLinking,
    startLinking: state.startLinking,
    completeLinking: state.completeLinking,
    mode: state.mode
  }));
  const blueprintMode = useUIStore((state) => state.blueprintMode);
  const isBlueprintEditing = blueprintMode === 'editing';
  const isHovered = hoveredElementId === element.id;

  const textOffsetX = 56;
  const textWidth = Math.max(80, element.size.width - textOffsetX - 12);

  const statusConfig = getStatusVisual(element.metadata?.status as string | undefined);
  const category = getDeviceCategory(element.type);

  const renderTypeIcon = () => {
    const accent = isHovered ? '#f8fafc' : '#e2e8f0';
    const baseFill = '#111827';

    if (category === 'bridge') {
      return (
        <Group>
          <Rect x={8} y={2} width={18} height={32} cornerRadius={3} fill={baseFill} stroke={accent} strokeWidth={2} />
          <Circle x={17} y={10} radius={2.5} fill={accent} />
          <Circle x={17} y={18} radius={2.5} fill={accent} opacity={0.6} />
          <Circle x={17} y={26} radius={2.5} fill={accent} opacity={0.4} />
        </Group>
      );
    }

    return (
      <Group>
        <Rect x={4} y={4} width={30} height={24} cornerRadius={8} fill={baseFill} stroke={accent} strokeWidth={2} />
        <Circle x={19} y={16} radius={8} fill={accent} />
        <Circle x={19} y={16} radius={3.5} fill={baseFill} />
      </Group>
    );
  };

  return (
    <Group
      x={element.position.x}
      y={element.position.y}
      draggable={mode === 'layout' && !linking.active && !isBlueprintEditing}
      listening={!isBlueprintEditing}
      onDragMove={(event) => {
        if (isBlueprintEditing) {
          return;
        }
        useCanvasStore.getState().updateElementPosition(element.id, {
          x: event.target.x(),
          y: event.target.y()
        });
      }}
      onMouseEnter={() => {
        if (isBlueprintEditing) return;
        setHoveredElement(element.id);
      }}
      onMouseLeave={() => {
        if (isBlueprintEditing) return;
        setHoveredElement(null);
      }}
      onMouseDown={(event) => {
        if (isBlueprintEditing) {
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
        if (isBlueprintEditing) {
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
        if (isBlueprintEditing) {
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
      onContextMenu={(event) => {
        if (isBlueprintEditing) {
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
      <Rect
        width={element.size.width}
        height={element.size.height}
        cornerRadius={6}
        fill={statusConfig.nodeFill}
        stroke={linking.active && linking.fromElementId === element.id ? '#38bdf8' : isHovered ? '#f8fafc' : '#0b1120'}
        strokeWidth={linking.active && linking.fromElementId === element.id ? 2.5 : isHovered ? 2 : 1.5}
      />
      <Group x={12} y={14}>{renderTypeIcon()}</Group>
      <Text
        text={element.metadata?.ip ?? '待分配 IP'}
        fontSize={12}
        fill={statusConfig.secondaryTextColor}
        x={textOffsetX}
        y={18}
        width={textWidth}
        ellipsis
      />
      <Text
        text={element.name}
        fontSize={13}
        fontStyle="bold"
        fill={statusConfig.textColor}
        x={textOffsetX}
        y={36}
        width={textWidth}
        ellipsis
      />
    </Group>
  );
};
