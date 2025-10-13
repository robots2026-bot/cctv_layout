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
import { nanoid } from '../../utils/nanoid';

const loadImageDimensions = (url: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = (event) => reject(event);
    image.src = url;
  });

export const CanvasStage = () => {
  const stageRef = useRef<KonvaStage | null>(null);
  const { viewport, setViewport, background, elements, connections, mode } = useCanvasStore((state) => ({
    viewport: state.viewport,
    setViewport: state.setViewport,
    background: state.background,
    elements: state.elements,
    connections: state.connections,
    mode: state.mode
  }));
  const addNotification = useUIStore((state) => state.addNotification);
  const [image] = useImage(background?.url ?? '', 'anonymous');
  const [dimensions, setDimensions] = useState({ width: viewport.width, height: viewport.height });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') return;
      const store = useCanvasStore.getState();
      if (store.isLocked) {
        return;
      }
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

    const handleDrop = async (event: DragEvent) => {
      event.preventDefault();
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) {
        return;
      }
      const store = useCanvasStore.getState();
      const files = Array.from(dataTransfer.files ?? []);
      const imageFile = files.find((file) => file.type.startsWith('image/'));
      if (imageFile) {
        if (store.mode !== 'blueprint') {
          addNotification({
            id: nanoid(),
            title: '蓝图导入失败',
            message: '请在蓝图模式下拖拽图纸进行导入',
            level: 'warning'
          });
          return;
        }
        if (store.isLocked) {
          addNotification({
            id: nanoid(),
            title: '画布已锁定',
            message: '解锁后才能导入或替换蓝图',
            level: 'warning'
          });
          return;
        }
        const limitBytes = 10 * 1024 * 1024;
        if (imageFile.size > limitBytes) {
          addNotification({
            id: nanoid(),
            title: '文件过大',
            message: '蓝图大小需小于 10MB',
            level: 'error'
          });
          return;
        }

        const objectUrl = URL.createObjectURL(imageFile);
        try {
          const { width, height } = await loadImageDimensions(objectUrl);
          const previousUrl = store.blueprint?.url;
          store.setBlueprint({
            url: objectUrl,
            naturalWidth: width,
            naturalHeight: height,
            scale: 1,
            opacity: 0.6,
            offset: { x: 0, y: 0 }
          });
          if (previousUrl && previousUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previousUrl);
          }
          addNotification({
            id: nanoid(),
            title: '蓝图已导入',
            message: `图纸 "${imageFile.name}" 已添加到画布`,
            level: 'info'
          });
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          addNotification({
            id: nanoid(),
            title: '图纸加载失败',
            message: '无法读取图片尺寸，请重试或更换文件',
            level: 'error'
          });
        }
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
      if (store.mode !== 'layout' || store.isLocked) {
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
  }, [addNotification]);

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
          if (mode === 'blueprint') {
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
          if (mode === 'blueprint') {
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
          if (mode === 'blueprint') {
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
        <Layer listening={mode !== 'blueprint'}>
          {connections.map((connection) => (
            <ConnectionLine key={connection.id} connection={connection} />
          ))}
        </Layer>
        <Layer listening={false}>
          <LinkingPreview />
        </Layer>
        <Layer listening={mode !== 'blueprint'}>
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
