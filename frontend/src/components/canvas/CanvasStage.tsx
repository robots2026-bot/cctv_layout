import { Stage, Layer, Rect, Image as KonvaImage, Group } from 'react-konva';
import { useEffect, useMemo, useRef, useState } from 'react';
import useImage from 'use-image';
import { useCanvasStore } from '../../stores/canvasStore';
import { ConnectionLine } from './ConnectionLine';
import { DeviceNode } from './DeviceNode';
import { CanvasContextMenu } from './CanvasContextMenu';
import { LinkingPreview } from './LinkingPreview';
import { CanvasLinkingControls } from './CanvasLinkingControls';
import { DEVICE_DRAG_DATA_FORMAT } from '../../utils/dragDrop';
import { DeviceSummary } from '../../types/canvas';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { KonvaEventObject } from 'konva/lib/Node';

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
  const [image] = useImage(background?.url ?? '', 'anonymous');
  const [dimensions, setDimensions] = useState({ width: viewport.width, height: viewport.height });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') return;
      const store = useCanvasStore.getState();
      if (store.selectedConnectionId) {
        store.removeConnection(store.selectedConnectionId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);


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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();

    const handleDragOver = (event: DragEvent) => {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      event.preventDefault();
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) {
        return;
      }
      const rawPayload =
        dataTransfer.getData(DEVICE_DRAG_DATA_FORMAT) || dataTransfer.getData('application/json');
      if (!rawPayload) {
        return;
      }

      let device: DeviceSummary | null = null;
      try {
        device = JSON.parse(rawPayload) as DeviceSummary;
      } catch (error) {
        device = null;
      }

      if (!device || !device.id) {
        return;
      }

      stage.setPointersPositions(event);
      const pointer = stage.getRelativePointerPosition();
      if (!pointer) {
        return;
      }
      const store = useCanvasStore.getState();
      if (store.mode !== 'layout') {
        return;
      }

      const dropPosition = { x: pointer.x, y: pointer.y };

      store.addDeviceToCanvas(device, dropPosition);
      useRealtimeStore.getState().consumeDevice(device.id);
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, []);

  return (
    <div className="relative flex flex-1 overflow-hidden bg-slate-950">
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
        onMouseDown={(event) => {
          const store = useCanvasStore.getState();
          const stageNode = stageRef.current;
          const isStageTarget = stageNode ? event.target === stageNode : false;
          if (event.evt.button !== 2 && isStageTarget) {
            store.closeContextMenu();
            store.selectConnection(null);
            store.selectElement('');
          }
          if (event.evt.button === 0 && isStageTarget && store.linking.active && store.linking.fromElementId) {
            store.cancelLinking();
          }
        }}
        onDragStart={(event: KonvaEventObject<DragEvent>) => {
          const stageNode = stageRef.current;
          if (!stageNode || event.target !== stageNode) {
            return;
          }
          useCanvasStore.getState().setHoveredElement(null);
          stageNode.container().style.cursor = 'grabbing';
        }}
        onDragMove={(event: KonvaEventObject<DragEvent>) => {
          const stageNode = stageRef.current;
          if (!stageNode || event.target !== stageNode) {
            return;
          }
          setViewport({ position: { x: stageNode.x(), y: stageNode.y() } });
        }}
        onDragEnd={(event: KonvaEventObject<DragEvent>) => {
          const stageNode = stageRef.current;
          if (!stageNode || event.target !== stageNode) {
            return;
          }
          setViewport({ position: { x: stageNode.x(), y: stageNode.y() } });
          stageNode.container().style.cursor = 'grab';
        }}
        onMouseMove={() => {
          const store = useCanvasStore.getState();
          if (!store.linking.active || !store.linking.fromElementId) return;
          const stageNode = stageRef.current;
          const pointer = stageNode?.getPointerPosition();
          if (pointer) {
            store.updateLinkingPointer(pointer);
          }
        }}
        onMouseUp={(event) => {
          const store = useCanvasStore.getState();
          if (event.evt.button === 0 && store.linking.active && store.linking.fromElementId) {
            store.cancelLinking();
          }
        }}
        onMouseLeave={() => {
          const stageNode = stageRef.current;
          if (!stageNode) return;
          stageNode.container().style.cursor = 'grab';
          useCanvasStore.getState().setHoveredElement(null);
        }}
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
          <Layer listening={false}>
            <KonvaImage image={image} width={image.width} height={image.height} />
          </Layer>
        )}
        <Layer>
          {connections.map((connection) => (
            <ConnectionLine key={connection.id} connection={connection} />
          ))}
        </Layer>
        <Layer listening={false}>
          <LinkingPreview />
        </Layer>
        <Layer>
          {elements.map((element) => (
            <DeviceNode key={element.id} element={element} />
          ))}
        </Layer>
      </Stage>
      <CanvasLinkingControls />
      <CanvasContextMenu />
    </div>
  );
};
