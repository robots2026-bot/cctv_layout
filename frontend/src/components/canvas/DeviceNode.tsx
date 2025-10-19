import { Circle, Group, Rect, Text } from 'react-konva';
import { CanvasElement } from '../../types/canvas';
import { useCanvasStore } from '../../stores/canvasStore';
import { deriveSwitchLabel, getDeviceCategory, getStatusVisual } from '../../utils/deviceVisual';
import { resolveBridgeRole } from '../../utils/bridgeRole';

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
    mode,
    isLocked
  } = useCanvasStore((state) => ({
    hoveredElementId: state.hoveredElementId,
    setHoveredElement: state.setHoveredElement,
    openContextMenu: state.openContextMenu,
    closeContextMenu: state.closeContextMenu,
    linking: state.linking,
    cancelLinking: state.cancelLinking,
    startLinking: state.startLinking,
    completeLinking: state.completeLinking,
    mode: state.mode,
    isLocked: state.isLocked
  }));
  const isBlueprintEditing = mode === 'blueprint';
  const isHovered = hoveredElementId === element.id;

  const statusConfig = getStatusVisual(element.metadata?.status as string | undefined);
  const category = getDeviceCategory(element.type);
  const bridgeRole = category === 'bridge' ? resolveBridgeRole(element.metadata as Record<string, unknown>, element.name) : 'UNKNOWN';
  const width = element.size?.width ?? 150;
  const height = element.size?.height ?? 70;
  const position = element.position ?? { x: 0, y: 0 };

  const textOffsetX = category === 'switch' ? 0 : 56;
  const textWidth = category === 'switch' ? width : Math.max(80, width - textOffsetX - 12);

  const renderTypeIcon = () => {
    const accent = isHovered ? '#f8fafc' : '#e2e8f0';
    const baseFill = '#111827';

    if (category === 'bridge') {
      const badgeLabel = bridgeRole === 'AP' ? 'AP' : bridgeRole === 'ST' ? 'ST' : null;
      return (
        <Group>
          <Rect x={8} y={2} width={18} height={32} cornerRadius={3} fill={baseFill} stroke={accent} strokeWidth={2} />
          <Circle x={17} y={10} radius={2.5} fill={accent} />
          <Circle x={17} y={18} radius={2.5} fill={accent} opacity={0.6} />
          <Circle x={17} y={26} radius={2.5} fill={accent} opacity={0.4} />
          {badgeLabel && (
            <Group x={6} y={36}>
              <Rect width={24} height={14} fill="#1d4ed8" cornerRadius={4} opacity={0.85} />
              <Text
                text={badgeLabel}
                fontSize={10}
                fontStyle="bold"
                fill="#f8fafc"
                width={24}
                height={14}
                verticalAlign="middle"
                align="center"
              />
            </Group>
          )}
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
      x={position.x}
      y={position.y}
      draggable={mode === 'layout' && !linking.active && !isBlueprintEditing && !isLocked}
      listening={!isBlueprintEditing}
      onDragMove={(event) => {
        if (isBlueprintEditing || isLocked) {
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
      {category === 'switch' ? (
        <>
          {(() => {
            const baseRadius = Math.min(width, height) / 2;
            const fillColor = '#1e3a8a';
            const strokeColor = linking.active && linking.fromElementId === element.id ? '#38bdf8' : isHovered ? '#93c5fd' : '#1d4ed8';
            const label = element.name?.trim() || deriveSwitchLabel((element.metadata?.model as string | undefined) || 'Switch');
            return (
              <>
                <Circle
                  x={width / 2}
                  y={height / 2}
                  radius={baseRadius}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={linking.active && linking.fromElementId === element.id ? 2.5 : isHovered ? 2 : 1.5}
                />
                <Text
                  text={label}
                  fontSize={16}
                  fontStyle="bold"
                  fill="#f8fafc"
                  x={0}
                  y={height / 2 - 10}
                  width={width}
                  align="center"
                  wrap="none"
                  ellipsis
                />
              </>
            );
          })()}
        </>
      ) : (
        <>
          <Rect
            width={width}
            height={height}
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
        </>
      )}
    </Group>
  );
};
