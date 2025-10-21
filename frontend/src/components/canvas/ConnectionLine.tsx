import { Arrow, Group, Label, Line, Tag, Text } from 'react-konva';
import { CanvasConnection } from '../../types/canvas';
import { useCanvasStore } from '../../stores/canvasStore';
import { getDeviceCategory, getStatusVisual } from '../../utils/deviceVisual';
import { resolveBridgeRole } from '../../utils/bridgeRole';
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
  const { elements, selectConnection, mode, hoveredConnectionId, setHoveredConnection, isLocked } = useCanvasStore((state) => ({
    elements: state.elements,
    selectConnection: state.selectConnection,
    mode: state.mode,
    hoveredConnectionId: state.hoveredConnectionId,
    setHoveredConnection: state.setHoveredConnection,
    isLocked: state.isLocked
  }));
  const isBlueprintEditing = mode === 'blueprint';

  const findElementByKey = (deviceKey?: string) => {
    if (!deviceKey) return undefined;
    return elements.find((item) => {
      if (item.deviceId === deviceKey || item.id === deviceKey || item.deviceMac === deviceKey) {
        return true;
      }
      const metadata = item.metadata as Record<string, unknown> | undefined;
      const sourceId = metadata?.sourceDeviceId as string | undefined;
      const sourceMac = metadata?.sourceDeviceMac as string | undefined;
      return sourceId === deviceKey || sourceMac === deviceKey;
    });
  };

  const fromElement = findElementByKey(connection.fromDeviceId);
  const toElement = findElementByKey(connection.toDeviceId);

  const resolvePoint = (element: typeof fromElement, fallback?: { x: number; y: number }) => {
    if (element) {
      return {
        x: element.position.x + element.size.width / 2,
        y: element.position.y + element.size.height / 2
      };
    }
    return fallback;
  };

  const fromPoint = resolvePoint(fromElement, connection.from);
  const toPoint = resolvePoint(toElement, connection.to);

  if (!fromPoint || !toPoint) {
    return null;
  }

  const baseFromCategory = getDeviceCategory(fromElement?.type);
  const baseToCategory = getDeviceCategory(toElement?.type);
  const baseFromRole =
    baseFromCategory === 'bridge'
      ? resolveBridgeRole(fromElement?.metadata as Record<string, unknown> | undefined, fromElement?.name)
      : 'UNKNOWN';
  const baseToRole =
    baseToCategory === 'bridge'
      ? resolveBridgeRole(toElement?.metadata as Record<string, unknown> | undefined, toElement?.name)
      : 'UNKNOWN';

  let orientedFromPoint = fromPoint;
  let orientedToPoint = toPoint;
  let orientedFromCategory = baseFromCategory;
  let orientedToCategory = baseToCategory;
  let orientedFromRole = baseFromRole;
  let orientedToRole = baseToRole;
  let isWireless = connection.kind === 'wireless';
  const isBridgePair = baseFromCategory === 'bridge' && baseToCategory === 'bridge';
  const rolesComplementary =
    isBridgePair &&
    ((baseFromRole === 'AP' && baseToRole === 'ST') || (baseFromRole === 'ST' && baseToRole === 'AP'));

  if (rolesComplementary) {
    if (!(baseFromRole === 'AP' && baseToRole === 'ST')) {
      orientedFromPoint = toPoint;
      orientedToPoint = fromPoint;
      orientedFromCategory = baseToCategory;
      orientedToCategory = baseFromCategory;
      orientedFromRole = baseToRole;
      orientedToRole = baseFromRole;
    }
    if (!isWireless) {
      isWireless = true;
    }
  } else if (isWireless) {
    // 数据异常或角色缺失时降级为普通连线
    isWireless = false;
  }

  const dx = orientedToPoint.x - orientedFromPoint.x;
  const dy = orientedToPoint.y - orientedFromPoint.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return null;
  }

  const shouldUseDualTrack =
    isWireless &&
    orientedFromCategory === 'bridge' &&
    orientedToCategory === 'bridge' &&
    orientedFromRole === 'AP' &&
    orientedToRole === 'ST';

  const segments = shouldUseDualTrack
    ? calculateConnectionSegments(orientedFromPoint, orientedToPoint, 'wireless')
    : null;

  const upstream = segments?.upstream ?? { start: orientedFromPoint, end: orientedToPoint };
  const downstream = segments?.downstream ?? { start: orientedFromPoint, end: orientedToPoint };
  const baseDash = shouldUseDualTrack ? [10, 6] : undefined;

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

  const handleContextMenu = (event: KonvaEventObject<MouseEvent>) => {
    if (mode === 'view' || isBlueprintEditing) {
      return;
    }
    event.evt.preventDefault();
    selectConnection(connection.id);
    const { clientX, clientY } = event.evt;
    useCanvasStore.getState().openContextMenu(connection.id, { x: clientX, y: clientY });
  };

  const handleMouseEnter = (event: KonvaEventObject<MouseEvent>) => {
    if (isBlueprintEditing || mode !== 'linking' || isLocked) {
      return;
    }
    setHoveredConnection(connection.id);
    const stage = event.target.getStage();
    if (stage) {
      stage.container().style.cursor = 'pointer';
    }
  };

  const handleMouseLeave = (event: KonvaEventObject<MouseEvent>) => {
    const stage = event.target.getStage();
    if (stage) {
      stage.container().style.cursor = 'default';
    }
    setHoveredConnection(null);
  };

  const isHovered =
    !connection.selected && hoveredConnectionId === connection.id && mode === 'linking' && !isLocked;

  const strokeWidthMain = connection.selected ? 5.4 : isHovered ? 4.8 : 4;
  const strokeWidthSecondary = connection.selected ? 5 : isHovered ? 4.4 : 4;
  const arrowOpacityMain = connection.selected ? 1 : isHovered ? 0.95 : 0.9;
  const downstreamOpacity = connection.selected ? 0.78 : isHovered ? 0.7 : 0.65;
  const lineShadowBlur = connection.selected ? 12 : isHovered ? 7 : 0;
  const lineShadowOpacity = connection.selected ? 0.85 : isHovered ? 0.55 : 0;

  return (
    <Group
      listening={!isBlueprintEditing}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Line
        points={makePoints(upstream.start, upstream.end)}
        stroke={status.fill}
        strokeWidth={strokeWidthMain}
        dash={baseDash}
        hitStrokeWidth={28}
        shadowEnabled={lineShadowBlur > 0}
        shadowColor={status.fill}
        shadowBlur={lineShadowBlur}
        shadowOpacity={lineShadowOpacity}
      />
      {shouldUseDualTrack && (
        <Line
          points={makePoints(downstream.start, downstream.end)}
          stroke={status.fill}
          opacity={downstreamOpacity}
          strokeWidth={strokeWidthSecondary}
          dash={baseDash}
          hitStrokeWidth={28}
          shadowEnabled={lineShadowBlur > 0}
          shadowColor={status.fill}
          shadowBlur={lineShadowBlur}
          shadowOpacity={lineShadowOpacity * 0.9}
        />
      )}

      {shouldUseDualTrack &&
        ARROW_POSITIONS.map((t) =>
          createArrow(t, upstream.start, upstream.end, status.fill, arrowOpacityMain)
        )}
      {shouldUseDualTrack &&
        ARROW_POSITIONS.map((t) =>
          createArrow(t, downstream.start, downstream.end, status.fill, downstreamOpacity)
        )}

      {shouldUseDualTrack ? (
        <>
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
        </>
      ) : (
        (() => {
          const combinedLabel = [upstreamLabel, downstreamLabel]
            .filter((value): value is string => Boolean(value))
            .join(' / ');
          if (!combinedLabel) {
            return null;
          }
          return (
            <Label
              x={upstreamLabelPos.x + labelOffsetVec.y * LABEL_OFFSET}
              y={upstreamLabelPos.y - labelOffsetVec.x * LABEL_OFFSET}
              listening={false}
            >
              <Tag fill={status.fill} opacity={0.85} cornerRadius={6} />
              <Text text={combinedLabel} fill={status.textColor} fontSize={11} padding={6} />
            </Label>
          );
        })()
      )}
    </Group>
  );
};
