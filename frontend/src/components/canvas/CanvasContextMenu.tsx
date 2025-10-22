import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '../../stores/canvasStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { useUIStore } from '../../stores/uiStore';
import { getDeviceCategory } from '../../utils/deviceVisual';

export const CanvasContextMenu = () => {
  const {
    contextMenu,
    removeElement,
    removeConnection,
    closeContextMenu,
    connections,
    elements,
    mode,
    isLocked,
    updateElementMetadata
  } = useCanvasStore((state) => ({
    contextMenu: state.contextMenu,
    removeElement: state.removeElement,
    removeConnection: state.removeConnection,
    closeContextMenu: state.closeContextMenu,
    connections: state.connections,
    elements: state.elements,
    mode: state.mode,
    isLocked: state.isLocked,
    updateElementMetadata: state.updateElementMetadata
  }));
  const layout = useLayoutStore((state) => state.layout);
  const { addNotification, openAliasDialog } = useUIStore((state) => ({
    addNotification: state.addNotification,
    openAliasDialog: state.openAliasDialog
  }));

  useEffect(() => {
    if (!contextMenu) return;
    const handleMouseDown = (event: MouseEvent) => {
      if ((event.target as HTMLElement)?.closest('[data-canvas-context-menu]')) {
        return;
      }
      closeContextMenu();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu, closeContextMenu]);

  if (mode === 'blueprint' || !contextMenu || !contextMenu.elementId) {
    return null;
  }

  const { elementId, position } = contextMenu;

  const connection = connections.find((item) => item.id === elementId);
  const isConnection = Boolean(connection);
  const element = elements.find((item) => item.id === elementId);

  const handleDelete = () => {
    if (isConnection) {
      removeConnection(elementId);
    } else {
      removeElement(elementId);
    }
    closeContextMenu();
  };

  const handleEditAlias = () => {
    if (!element || !element.deviceId || !layout) {
      return;
    }
    const category = getDeviceCategory(element.type);
    if (category === 'switch') {
      return;
    }
    openAliasDialog({
      title: '编辑设备别名',
      confirmLabel: '保存',
      initialValue: element.name ?? '',
      onConfirm: async (nextName: string) => {
        try {
          await useRealtimeStore
            .getState()
            .updateDeviceName(layout.projectId, element.deviceId!, { name: nextName });
          updateElementMetadata(element.id, {
            name: nextName,
            metadata: {
              ...(element.metadata ?? {}),
              sourceAlias: nextName
            }
          });
          addNotification({
            id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2),
            title: '别名已更新',
            message: `设备已更新为 “${nextName}”。`,
            level: 'info'
          });
        } catch (error) {
          console.error('更新设备别名失败', error);
          throw new Error('更新设备别名失败，请稍后重试');
        }
      }
    });
    closeContextMenu();
  };

  const canEditAlias =
    !isConnection && element && element.deviceId && layout && getDeviceCategory(element.type) !== 'switch';

  return createPortal(
    <div
      data-canvas-context-menu
      className="z-50 rounded border border-slate-700 bg-slate-900/95 px-3 py-2 text-sm text-slate-200 shadow-xl"
      style={{ position: 'fixed', top: position.y, left: position.x, minWidth: 140 }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {canEditAlias && !isLocked && (
        <button
          type="button"
          onClick={handleEditAlias}
          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sky-100 transition hover:bg-slate-800/80"
        >
          编辑别名
        </button>
      )}
      {canEditAlias && !isLocked && <div className="my-1 h-px bg-slate-800/80" />}
      <button
        type="button"
        onClick={handleDelete}
        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-slate-100 transition hover:bg-slate-800/80"
      >
        {isConnection ? '删除连线' : '删除设备'}
      </button>
      {isConnection && connection && (
        <div className="mt-1 text-xs text-slate-400">
          {connection.bandwidth?.upstreamMbps !== undefined && `↑ ${connection.bandwidth.upstreamMbps} Mb/s`}
          {connection.bandwidth?.downstreamMbps !== undefined && ` ↓ ${connection.bandwidth.downstreamMbps} Mb/s`}
          {connection.bandwidth?.upstreamMbps === undefined &&
            connection.bandwidth?.downstreamMbps === undefined && '暂无带宽数据'}
        </div>
      )}
      {!isConnection && element && (
        <div className="mt-1 text-xs text-slate-400">{element.name}</div>
      )}
    </div>,
    document.body
  );
};
