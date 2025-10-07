import { Stage, Layer, Rect, Image as KonvaImage, Group } from 'react-konva';
import { useEffect, useMemo, useRef, useState } from 'react';
import useImage from 'use-image';
import { useCanvasStore } from '../../stores/canvasStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { ConnectionLine } from './ConnectionLine';
import { DeviceNode } from './DeviceNode';

const GridBackground = () => {
  const { width, height, gridSize } = useCanvasStore((state) => ({
    width: state.viewport.width,
    height: state.viewport.height,
    gridSize: state.gridSize
  }));

  const { vertical, horizontal } = useMemo(() => {
    const verticalLines: JSX.Element[] = [];
    const horizontalLines: JSX.Element[] = [];
    for (let x = 0; x < width; x += gridSize) {
      verticalLines.push(
        <Rect key={`v-${x}`} x={x} y={0} width={1} height={height} fill="rgba(148, 163, 184, 0.08)" />
      );
    }
    for (let y = 0; y < height; y += gridSize) {
      horizontalLines.push(
        <Rect key={`h-${y}`} x={0} y={y} width={width} height={1} fill="rgba(148, 163, 184, 0.08)" />
      );
    }
    return { vertical: verticalLines, horizontal: horizontalLines };
  }, [gridSize, height, width]);

  return (
    <Group>
      {vertical}
      {horizontal}
    </Group>
  );
};

export const CanvasStage = () => {
  const stageRef = useRef<any>(null);
  const { viewport, setViewport, background, elements, connections } = useCanvasStore((state) => ({
    viewport: state.viewport,
    setViewport: state.setViewport,
    background: state.background,
    elements: state.elements,
    connections: state.connections
  }));
  const { backgroundOpacity } = useLayoutStore((state) => ({ backgroundOpacity: state.layout?.backgroundOpacity ?? 0.6 }));
  const [image] = useImage(background?.url ?? '', 'anonymous');
  const [dimensions, setDimensions] = useState({ width: viewport.width, height: viewport.height });

  useEffect(() => {
    const resize = () => {
      const container = stageRef.current?.container();
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
      setDimensions({ width: rect.width, height: rect.height });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [setViewport]);

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-950">
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        x={viewport.position.x}
        y={viewport.position.y}
        draggable
        className="cursor-grab"
        onDragMove={(event) =>
          setViewport({ position: { x: event.target.x(), y: event.target.y() } })
        }
        onDragEnd={(event) =>
          setViewport({ position: { x: event.target.x(), y: event.target.y() } })
        }
        onWheel={(event) => {
          event.evt.preventDefault();
          const scaleBy = 1.05;
          const direction = event.evt.deltaY > 0 ? 1 : -1;
          const newScale = direction > 0 ? viewport.scale / scaleBy : viewport.scale * scaleBy;
          setViewport({ scale: newScale });
        }}
      >
        <Layer listening={false}>
          <GridBackground />
        </Layer>
        {image && (
          <Layer listening={false} opacity={backgroundOpacity}>
            <KonvaImage image={image} width={image.width} height={image.height} />
          </Layer>
        )}
        <Layer>
          {elements.map((element) => (
            <DeviceNode key={element.id} element={element} />
          ))}
          {connections.map((connection) => (
            <ConnectionLine key={connection.id} connection={connection} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};
