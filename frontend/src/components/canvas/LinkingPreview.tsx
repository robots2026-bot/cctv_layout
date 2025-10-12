import { Arrow } from 'react-konva';
import { useCanvasStore } from '../../stores/canvasStore';

export const LinkingPreview = () => {
  const { linking, elements } = useCanvasStore((state) => ({
    linking: state.linking,
    elements: state.elements
  }));

  if (!linking.active || !linking.fromElementId || !linking.pointer) {
    return null;
  }

  const fromElement = elements.find((element) => element.id === linking.fromElementId);
  if (!fromElement) {
    return null;
  }

  const fromCenter = {
    x: fromElement.position.x + fromElement.size.width / 2,
    y: fromElement.position.y + fromElement.size.height / 2
  };

  return (
    <Arrow
      points={[fromCenter.x, fromCenter.y, linking.pointer.x, linking.pointer.y]}
      stroke="#38bdf8"
      fill="#38bdf8"
      strokeWidth={3}
      dash={[10, 6]}
      pointerLength={10}
      pointerWidth={10}
      listening={false}
    />
  );
};
