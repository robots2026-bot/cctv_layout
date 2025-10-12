import { Layer, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import { useEffect } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';

export const BlueprintLayer = () => {
  const { blueprint, updateBlueprint } = useCanvasStore((state) => ({
    blueprint: state.blueprint,
    updateBlueprint: state.updateBlueprint
  }));
  const blueprintMode = useUIStore((state) => state.blueprintMode);
  const [image, status] = useImage(blueprint?.url ?? '', 'anonymous');

  useEffect(() => {
    if (!image || !blueprint) {
      return;
    }
    if (blueprint.naturalWidth === image.width && blueprint.naturalHeight === image.height) {
      return;
    }
    updateBlueprint({ naturalWidth: image.width, naturalHeight: image.height });
  }, [image, blueprint, updateBlueprint]);

  if (!blueprint) {
    return null;
  }

  const isEditing = blueprintMode === 'editing';
  const width = image?.width ?? blueprint.naturalWidth;
  const height = image?.height ?? blueprint.naturalHeight;

  return (
    <Layer listening={isEditing} hitStrokeWidth={0}>
      {image ? (
        <KonvaImage
          image={image}
          width={width}
          height={height}
          x={blueprint.offset.x}
          y={blueprint.offset.y}
          opacity={blueprint.opacity}
          scaleX={blueprint.scale}
          scaleY={blueprint.scale}
          draggable={isEditing}
          listening={isEditing}
          onDragMove={(event) => {
            if (!isEditing) return;
            updateBlueprint({ offset: { x: event.target.x(), y: event.target.y() } });
          }}
          onDragEnd={(event) => {
            if (!isEditing) return;
            updateBlueprint({ offset: { x: event.target.x(), y: event.target.y() } });
          }}
        />
      ) : (
        <Text
          x={24}
          y={24}
          fontSize={16}
          fill="#cbd5f5"
          text={status === 'loading' ? '蓝图加载中…' : '蓝图加载失败'}
          listening={false}
        />
      )}
    </Layer>
  );
};
