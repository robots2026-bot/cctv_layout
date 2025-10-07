import { Group, Rect, Text } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { CanvasElement } from '../../types/canvas';
import { useCanvasStore } from '../../stores/canvasStore';

interface DeviceNodeProps {
  element: CanvasElement;
}

export const DeviceNode = ({ element }: DeviceNodeProps) => {
  const selectElement = useCanvasStore((state) => state.selectElement);

  const handleSelect = (event: KonvaEventObject<MouseEvent>) => {
    event.cancelBubble = true;
    selectElement(element.id);
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
      onClick={handleSelect}
    >
      <Rect
        width={element.size.width}
        height={element.size.height}
        cornerRadius={6}
        fill={element.selected ? 'rgba(94, 234, 212, 0.25)' : 'rgba(148, 163, 184, 0.15)'}
        stroke={element.selected ? '#5eead4' : 'rgba(148, 163, 184, 0.25)'}
        strokeWidth={1.5}
      />
      <Text
        text={element.name}
        fontSize={14}
        fontStyle="bold"
        fill="#e2e8f0"
        x={8}
        y={6}
      />
      <Text
        text={element.metadata?.ip ?? '待分配 IP'}
        fontSize={12}
        fill="#94a3b8"
        x={8}
        y={28}
      />
    </Group>
  );
};
