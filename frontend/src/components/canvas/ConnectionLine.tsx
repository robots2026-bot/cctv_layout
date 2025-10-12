import { Arrow, Group, Label, Line, Tag, Text } from 'react-konva';
import { CanvasConnection } from '../../types/canvas';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';
import { getStatusVisual } from '../../utils/deviceVisual';
import type { KonvaEventObject } from 'konva/lib/Node';

interface ConnectionLineProps {
  connection: CanvasConnection;
}

const LABEL_OFFSET = 12;
const ARROW_LENGTH = 16;
const TRACK_OFFSET = 5;
const ARROW_POSITIONS = [0.35, 0.7];

interface Point {
  x: number;
  y: number;
}

interface ConnectionSegments {
  upstream: { start: Point; end: Point };
  downstream: { start: Point; end: Point };
  baseDash?: number[];
  length: number;
}

const calculateConnectionSegments = (
  fromPoint: Point,
  toPoint: Point,
  kind: CanvasConnection['kind']
): ConnectionSegments | null => {
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  const baseLength = Math.hypot(dx, dy);

  if (baseLength === 0) {
    return null;
  }

  const dir = { x: dx / baseLength, y: dy / baseLength };
  const normal = { x: -dir.y, y: dir.x };
  const offsetVec = {
    x: normal.x * TRACK_OFFSET,
    y: normal.y * TRACK_OFFSET
  };

  const upstreamStart = {
    x: fromPoint.x + offsetVec.x,
    y: fromPoint.y + offsetVec.y
  };
  const upstreamEnd = {
    x: toPoint.x + offsetVec.x,
    y: toPoint.y + offsetVec.y
  };
  const downstreamStart = {
    x: toPoint.x - offsetVec.x,
    y: toPoint.y - offsetVec.y
  };
  const downstreamEnd = {
    x: fromPoint.x - offsetVec.x,
    y: fromPoint.y - offsetVec.y
  };

  return {
    upstream: { start: upstreamStart, end: upstreamEnd },
    downstream: { start: downstreamStart, end: downstreamEnd },
    baseDash: kind === 'wireless' ? [12, 8] : undefined,
    length: baseLength
  };
};

export const ConnectionLine = ({ connection }: ConnectionLineProps) => {
  const { elements, selectConnection, mode } = useCanvasStore((state) => ({
    elements: state.elements,
    selectConnection: state.selectConnection,
    mode: state.mode
  }));
  const isBlueprintEditing = mode === 'blueprint';

  const resolvePoint = (deviceKey?: string, fallback?: { x: number; y: number }) => {
    if (!deviceKey) {
      return fallback;
    }
    const element = elements.find(
      (item) => item.deviceId === deviceKey || item.id === deviceKey
    );
    if (!element) {
      return fallback;
    }
    return {
      x: element.position.x + element.size.width / 2,
      y: element.position.y + element.size.height / 2
    };
  };

  const fromPoint = resolvePoint(connection.fromDeviceId, connection.from);
  const toPoint = resolvePoint(connection.toDeviceId, connection.to);

  if (!fromPoint || !toPoint) {
    return null;
  }

  const segments = calculateConnectionSegments(fromPoint, toPoint, connection.kind);
  if (!segments) {
    return null;
  }

  const { upstream, downstream, baseDash, length } = segments;
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;

  const status = getStatusVisual(connection.status ?? 'online');


  const formatLabel = (value?: number, arrow: string = '↕') =>
    value !== undefined ? `${arrow} ${Math.round(value)} Mb/s` : undefined;

  const upstreamLabel = formatLabel(connection.bandwidth?.upstreamMbps, '↑');
  const downstreamLabel = formatLabel(connection.bandwidth?.downstreamMbps, '↓');

  const makePoints = (start: { x: number; y: number }, end: { x: number; y: number }) => [
    start.x,
    start.y,
    end.x,
    end.y
  ];

  const pointAt = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    t: number
  ) => ({
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  });

  const createArrow = (
    t: number,
    start: { x: number; y: number },
    end: { x: number; y: number },
    color: string,
    opacity = 1
  ) => {
    const pos = pointAt(start, end, t);
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    const dirVec = {
      x: (end.x - start.x) / segmentLength,
      y: (end.y - start.y) / segmentLength
    };
    const half = ARROW_LENGTH / 2;
    const startPoint = {
      x: pos.x - dirVec.x * half,
      y: pos.y - dirVec.y * half
    };
    const endPoint = {
      x: pos.x + dirVec.x * half,
      y: pos.y + dirVec.y * half
    };
    return (
      <Arrow
        key={`${color}-${t}-${opacity}`}
        points={[startPoint.x, startPoint.y, endPoint.x, endPoint.y]}
        stroke={color}
        fill={color}
        strokeWidth={2}
        pointerLength={6}
        pointerWidth={6}
        opacity={opacity}
        listening={false}
      />
    );
  };

  const upstreamLabelPos = pointAt(upstream.start, upstream.end, 0.5);
  const downstreamLabelPos = pointAt(downstream.start, downstream.end, 0.5);

  const labelOffsetVec = {
    x: dx / length,
    y: dy / length
  };

  const handleClick = (event: KonvaEventObject<MouseEvent>) => {
    if (mode === 'view' || isBlueprintEditing) {
      return;
    }
    event.cancelBubble = true;
    selectConnection(connection.id);
  };

  const handleContextMenu = (event: KonvaEventObject<MouseEvent>) => {
    if (mode === 'view' || isBlueprintEditing) {
      return;
    }
    event.evt.preventDefault();
    selectConnection(connection.id);
    const { clientX, clientY } = event.evt;
    useCanvasStore.getState().openContextMenu(connection.id, { x: clientX, y: clientY });
  };

  const strokeWidthMain = connection.selected ? 5 : 4;
  const strokeWidthSecondary = connection.selected ? 4.5 : 4;
  const arrowOpacityMain = connection.selected ? 1 : 0.9;
  const downstreamOpacity = connection.selected ? 0.75 : 0.65;

  return (
    <Group listening={!isBlueprintEditing} onClick={handleClick} onContextMenu={handleContextMenu}>
      <Line
        points={makePoints(upstream.start, upstream.end)}
        stroke={status.fill}
        strokeWidth={strokeWidthMain}
        dash={baseDash}
      />
      <Line
        points={makePoints(downstream.start, downstream.end)}
        stroke={status.fill}
        opacity={downstreamOpacity}
        strokeWidth={strokeWidthSecondary}
        dash={baseDash}
      />

      {ARROW_POSITIONS.map((t) =>
        createArrow(t, upstream.start, upstream.end, status.fill, arrowOpacityMain)
      )}
      {ARROW_POSITIONS.map((t) =>
        createArrow(t, downstream.start, downstream.end, status.fill, downstreamOpacity)
      )}

      {upstreamLabel && (
        <Label
          x={upstreamLabelPos.x + labelOffsetVec.x * LABEL_OFFSET}
          y={upstreamLabelPos.y + labelOffsetVec.y * LABEL_OFFSET}
          listening={false}
        >
          <Tag fill={status.fill} opacity={0.85} cornerRadius={6} />
          <Text text={upstreamLabel} fill={status.textColor} fontSize={11} padding={6} />
        </Label>
      )}
      {downstreamLabel && (
        <Label
          x={downstreamLabelPos.x - labelOffsetVec.x * LABEL_OFFSET}
          y={downstreamLabelPos.y - labelOffsetVec.y * LABEL_OFFSET}
          listening={false}
        >
          <Tag fill={status.fill} opacity={0.65} cornerRadius={6} />
          <Text text={downstreamLabel} fill={status.textColor} fontSize={11} padding={6} />
        </Label>
      )}
    </Group>
  );
};
