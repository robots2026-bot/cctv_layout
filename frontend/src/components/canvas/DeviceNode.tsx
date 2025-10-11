import { Circle, Group, Rect, Text } from 'react-konva';
import { CanvasElement } from '../../types/canvas';
import { useCanvasStore } from '../../stores/canvasStore';
import { getDeviceCategory, getStatusVisual } from '../../utils/deviceVisual';

interface DeviceNodeProps {
  element: CanvasElement;
}

export const DeviceNode = ({ element }: DeviceNodeProps) => {
  const hoveredElementId = useCanvasStore((state) => state.hoveredElementId);
  const setHoveredElement = useCanvasStore((state) => state.setHoveredElement);
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
      draggable
      onDragMove={(event) =>
        useCanvasStore.getState().updateElementPosition(element.id, {
          x: event.target.x(),
          y: event.target.y()
        })
      }
      onMouseEnter={() => setHoveredElement(element.id)}
      onMouseLeave={() => setHoveredElement(null)}
    >
      <Rect
        width={element.size.width}
        height={element.size.height}
        cornerRadius={6}
        fill={statusConfig.nodeFill}
        stroke={isHovered ? '#f8fafc' : '#0b1120'}
        strokeWidth={isHovered ? 2 : 1.5}
      />
      <Group x={12} y={14}>{renderTypeIcon()}</Group>
      <Text
        text={element.name}
        fontSize={13}
        fontStyle="bold"
        fill={statusConfig.textColor}
        x={textOffsetX}
        y={18}
        width={textWidth}
        ellipsis
      />
      <Text
        text={element.metadata?.ip ?? '待分配 IP'}
        fontSize={12}
        fill={statusConfig.secondaryTextColor}
        x={textOffsetX}
        y={38}
        width={textWidth}
        ellipsis
      />
    </Group>
  );
};
