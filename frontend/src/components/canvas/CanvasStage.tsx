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
import { uploadBlueprintFile } from '../../services/fileUploads';
import { useLayoutStore } from '../../stores/layoutStore';

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

export const CanvasStage = () => {
  const stageRef = useRef<KonvaStage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
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
    const measureContainer = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
      setDimensions({ width: rect.width, height: rect.height });
    };

    measureContainer();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            measureContainer();
          })
        : null;

    if (resizeObserver && containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', measureContainer);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureContainer);
    };
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
        const layout = useLayoutStore.getState().layout;
        if (!layout) {
          addNotification({
            id: nanoid(),
            title: '蓝图导入失败',
            message: '请先加载布局后再导入蓝图',
            level: 'error'
          });
          return;
        }
        const limitBytes = 20 * 1024 * 1024;
        if (imageFile.size > limitBytes) {
          addNotification({
            id: nanoid(),
            title: '文件过大',
            message: '蓝图大小需小于 20MB',
            level: 'error'
          });
          return;
        }

        try {
          addNotification({
            id: nanoid(),
            title: '蓝图上传中',
            message: `正在上传图纸 "${imageFile.name}"，请稍候…`,
            level: 'info'
          });
          const uploadResult = await uploadBlueprintFile(imageFile, {
            projectId: layout.projectId,
            layoutId: layout.id
          });
          const width = uploadResult.width ?? uploadResult.dimensions.width;
          const height = uploadResult.height ?? uploadResult.dimensions.height;
          const sizeBytes = uploadResult.sizeBytes ?? imageFile.size;
          store.setBlueprint({
            url: uploadResult.url,
            naturalWidth: width,
            naturalHeight: height,
            scale: 1,
            opacity: 0.6,
            offset: { x: 0, y: 0 },
            fileId: uploadResult.id
          });
          addNotification({
            id: nanoid(),
            title: '蓝图已导入',
            message: `图纸 "${imageFile.name}" 已上传，尺寸 ${width}×${height}，约 ${formatBytes(sizeBytes)}`,
            level: 'info'
          });
        } catch (error) {
          addNotification({
            id: nanoid(),
            title: '图纸加载失败',
            message:
              error instanceof Error
                ? error.message
                : '无法读取图片尺寸，请重试或更换文件',
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
    <div ref={containerRef} className="relative flex min-w-0 flex-1 overflow-hidden bg-slate-950">
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
          const stageNode = stageRef.current;
          if (!stageNode) {
            return;
          }
          const pointer = stageNode.getPointerPosition();
          if (!pointer) {
            return;
          }
          const scaleBy = 1.05;
          const oldScale = stageNode.scaleX() || 1;
          const direction = event.evt.deltaY > 0 ? 1 : -1;
          let nextScale = direction > 0 ? oldScale / scaleBy : oldScale * scaleBy;
          nextScale = Math.min(4, Math.max(0.2, nextScale));
          const mousePointTo = {
            x: (pointer.x - stageNode.x()) / oldScale,
            y: (pointer.y - stageNode.y()) / oldScale
          };
          const newPosition = {
            x: pointer.x - mousePointTo.x * nextScale,
            y: pointer.y - mousePointTo.y * nextScale
          };
          setViewport({ scale: nextScale, position: newPosition });
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
