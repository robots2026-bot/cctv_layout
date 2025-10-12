import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import { useEffect, useRef, useState } from 'react';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import useImage from 'use-image';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';
import { ConnectionLine } from './ConnectionLine';
import { DeviceNode } from './DeviceNode';
import { BlueprintLayer } from './BlueprintLayer';
import { CanvasContextMenu } from './CanvasContextMenu';
import { LinkingPreview } from './LinkingPreview';
import { CanvasLinkingControls } from './CanvasLinkingControls';
import { DEVICE_DRAG_DATA_FORMAT } from '../../utils/dragDrop';
import { DeviceSummary } from '../../types/canvas';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { KonvaEventObject } from 'konva/lib/Node';

export const CanvasStage = () => {
  const stageRef = useRef<KonvaStage | null>(null);
  const { viewport, setViewport, background, elements, connections } = useCanvasStore((state) => ({
    viewport: state.viewport,
    setViewport: state.setViewport,
    background: state.background,
    elements: state.elements,
    connections: state.connections
  }));
  const blueprintMode = useUIStore((state) => state.blueprintMode);
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
          if (blueprintMode === 'editing') {
            return;
          }
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
          if (blueprintMode === 'editing') {
            return;
          }
          const store = useCanvasStore.getState();
          if (!store.linking.active || !store.linking.fromElementId) return;
          const stageNode = stageRef.current;
          if (!stageNode) return;
          const pointerPosition = stageNode.getPointerPosition();
          if (!pointerPosition) return;
          const scaleX = stageNode.scaleX() || 1;
          const scaleY = stageNode.scaleY() || 1;
          const pointer = {
            x: (pointerPosition.x - stageNode.x()) / scaleX,
            y: (pointerPosition.y - stageNode.y()) / scaleY
          };
          store.updateLinkingPointer(pointer);
        }}
        onMouseUp={(event) => {
          if (blueprintMode === 'editing') {
            return;
          }
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
        {image && (
          <Layer listening={false}>
            <KonvaImage image={image} width={image.width} height={image.height} />
          </Layer>
        )}
        <BlueprintLayer />
        <Layer listening={blueprintMode !== 'editing'}>
          {connections.map((connection) => (
            <ConnectionLine key={connection.id} connection={connection} />
          ))}
        </Layer>
        <Layer listening={false}>
          <LinkingPreview />
        </Layer>
        <Layer listening={blueprintMode !== 'editing'}>
          {elements.map((element) => (
            <DeviceNode key={element.id} element={element} />
          ))}
        </Layer>
      </Stage>
      <CanvasLinkingControls />
      <CanvasContextMenu />
      {blueprintMode === 'editing' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center pt-20">
          <div className="rounded border border-amber-400/50 bg-slate-900/80 px-4 py-2 text-sm text-amber-100 shadow-lg shadow-slate-900/60">
            蓝图调整中，设备与连线操作已锁定
          </div>
        </div>
      )}
    </div>
  );
};
