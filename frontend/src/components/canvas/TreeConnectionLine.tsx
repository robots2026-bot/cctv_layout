import { Arrow, Group, Label, Line, Tag, Text } from 'react-konva';
import { CanvasConnection, CanvasElement } from '../../types/canvas';
import { getDeviceCategory, getStatusVisual } from '../../utils/deviceVisual';
import { resolveBridgeRole } from '../../utils/bridgeRole';

interface Point {
  x: number;
  y: number;
}

interface TreeConnectionLineProps {
  connection?: CanvasConnection;
  fromElement: CanvasElement;
  toElement: CanvasElement;
  fromPosition: Point;
  toPosition: Point;
}

const LABEL_OFFSET = 12;
const ARROW_LENGTH = 16;
const TRACK_OFFSET = 5;
const ARROW_POSITIONS = [0.35, 0.7];

const calculateConnectionSegments = (fromPoint: Point, toPoint: Point) => {
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

  return {
    upstream: {
      start: { x: fromPoint.x + offsetVec.x, y: fromPoint.y + offsetVec.y },
      end: { x: toPoint.x + offsetVec.x, y: toPoint.y + offsetVec.y }
    },
    downstream: {
      start: { x: toPoint.x - offsetVec.x, y: toPoint.y - offsetVec.y },
      end: { x: fromPoint.x - offsetVec.x, y: fromPoint.y - offsetVec.y }
    },
    length: baseLength
  };
};

const pointAt = (start: Point, end: Point, t: number) => ({
  x: start.x + (end.x - start.x) * t,
  y: start.y + (end.y - start.y) * t
});

const makeArrow = (t: number, start: Point, end: Point, color: string, opacity = 1) => {
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

export const TreeConnectionLine = ({
  connection,
  fromElement,
  toElement,
  fromPosition,
  toPosition
}: TreeConnectionLineProps) => {
  const status = getStatusVisual(connection?.status ?? 'online');
  const fromCategory = getDeviceCategory(fromElement.type);
  const toCategory = getDeviceCategory(toElement.type);
  const fromRole =
    fromCategory === 'bridge'
      ? resolveBridgeRole(fromElement.metadata as Record<string, unknown>, fromElement.name)
      : 'UNKNOWN';
  const toRole =
    toCategory === 'bridge'
      ? resolveBridgeRole(toElement.metadata as Record<string, unknown>, toElement.name)
      : 'UNKNOWN';

  let orientedFromPoint = fromPosition;
  let orientedToPoint = toPosition;
  let orientedFromCategory = fromCategory;
  let orientedToCategory = toCategory;
  let orientedFromRole = fromRole;
  let orientedToRole = toRole;
  let isWireless = (connection?.kind ?? 'wired') === 'wireless';

  const isBridgePair = fromCategory === 'bridge' && toCategory === 'bridge';
  const rolesComplementary =
    isBridgePair &&
    ((fromRole === 'AP' && toRole === 'ST') || (fromRole === 'ST' && toRole === 'AP'));

  if (rolesComplementary) {
    if (!(fromRole === 'AP' && toRole === 'ST')) {
      orientedFromPoint = toPosition;
      orientedToPoint = fromPosition;
      orientedFromCategory = toCategory;
      orientedToCategory = fromCategory;
      orientedFromRole = toRole;
      orientedToRole = fromRole;
    }
    if (!isWireless) {
      isWireless = true;
    }
  } else if (isWireless) {
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
    ? calculateConnectionSegments(orientedFromPoint, orientedToPoint)
    : null;

  const upstream = segments?.upstream ?? { start: orientedFromPoint, end: orientedToPoint };
  const downstream = segments?.downstream ?? { start: orientedFromPoint, end: orientedToPoint };
  const baseDash = shouldUseDualTrack ? [10, 6] : undefined;

  const upstreamLabel =
    connection?.bandwidth?.upstreamMbps !== undefined
      ? `↑ ${Math.round(connection.bandwidth.upstreamMbps)} Mb/s`
      : undefined;
  const downstreamLabel =
    connection?.bandwidth?.downstreamMbps !== undefined
      ? `↓ ${Math.round(connection.bandwidth.downstreamMbps)} Mb/s`
      : undefined;

  const upstreamMid = pointAt(upstream.start, upstream.end, 0.5);
  const downstreamMid = pointAt(downstream.start, downstream.end, 0.5);
  const labelOffsetVec = {
    x: dx / length,
    y: dy / length
  };

  const strokeWidthMain = connection?.selected ? 5.4 : 4;
  const strokeWidthSecondary = connection?.selected ? 5 : 4;
  const arrowOpacityMain = connection?.selected ? 1 : 0.9;
  const downstreamOpacity = connection?.selected ? 0.78 : 0.65;
  const lineShadowBlur = connection?.selected ? 12 : 0;
  const lineShadowOpacity = connection?.selected ? 0.85 : 0;

  return (
    <Group listening={false}>
      <Line
        points={[upstream.start.x, upstream.start.y, upstream.end.x, upstream.end.y]}
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
          points={[downstream.start.x, downstream.start.y, downstream.end.x, downstream.end.y]}
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
          makeArrow(t, upstream.start, upstream.end, status.fill, arrowOpacityMain)
        )}
      {shouldUseDualTrack &&
        ARROW_POSITIONS.map((t) =>
          makeArrow(t, downstream.start, downstream.end, status.fill, downstreamOpacity)
        )}

      {shouldUseDualTrack ? (
        <>
          {upstreamLabel && (
            <Label
              x={upstreamMid.x + labelOffsetVec.x * LABEL_OFFSET}
              y={upstreamMid.y + labelOffsetVec.y * LABEL_OFFSET}
              listening={false}
            >
              <Tag fill={status.fill} opacity={0.85} cornerRadius={6} />
              <Text text={upstreamLabel} fill={status.textColor} fontSize={11} padding={6} />
            </Label>
          )}
          {downstreamLabel && (
            <Label
              x={downstreamMid.x - labelOffsetVec.x * LABEL_OFFSET}
              y={downstreamMid.y - labelOffsetVec.y * LABEL_OFFSET}
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
              x={upstreamMid.x + labelOffsetVec.y * LABEL_OFFSET}
              y={upstreamMid.y - labelOffsetVec.x * LABEL_OFFSET}
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
