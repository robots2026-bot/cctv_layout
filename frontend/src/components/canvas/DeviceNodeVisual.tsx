import { Circle, Group, Rect, Text } from 'react-konva';
import { CanvasElement } from '../../types/canvas';
import { getDeviceCategory, getStatusVisual, deriveSwitchLabel } from '../../utils/deviceVisual';
import { resolveBridgeRole } from '../../utils/bridgeRole';

interface DeviceNodeVisualProps {
  element: CanvasElement;
  isHovered?: boolean;
  isLinkingSource?: boolean;
}

export const DeviceNodeVisual = ({
  element,
  isHovered = false,
  isLinkingSource = false
}: DeviceNodeVisualProps) => {
  const statusConfig = getStatusVisual(element.metadata?.status as string | undefined);
  const category = getDeviceCategory(element.type);
  const bridgeRole =
    category === 'bridge'
      ? resolveBridgeRole(element.metadata as Record<string, unknown>, element.name)
      : 'UNKNOWN';
  const width = element.size?.width ?? 150;
  const height = element.size?.height ?? 70;
  const textOffsetX = category === 'switch' ? 0 : 56;
  const textWidth = category === 'switch' ? width : Math.max(80, width - textOffsetX - 12);

  const renderTypeIcon = () => {
    const accent = isHovered ? '#f8fafc' : '#e2e8f0';
    const baseFill = '#111827';

    if (category === 'bridge') {
      const badgeLabel = bridgeRole === 'AP' ? 'AP' : bridgeRole === 'ST' ? 'ST' : null;
      const badgeFill =
        bridgeRole === 'AP'
          ? 'rgba(37, 99, 235, 0.88)'
          : bridgeRole === 'ST'
            ? 'rgba(249, 115, 22, 0.9)'
            : 'rgba(148, 163, 184, 0.85)';
      const badgeTextColor = bridgeRole === 'ST' ? '#fff7ed' : '#f8fafc';
      return (
        <Group>
          <Rect x={8} y={2} width={18} height={32} cornerRadius={3} fill={baseFill} stroke={accent} strokeWidth={2} />
          <Circle x={17} y={10} radius={2.5} fill={accent} />
          <Circle x={17} y={18} radius={2.5} fill={accent} opacity={0.6} />
          <Circle x={17} y={26} radius={2.5} fill={accent} opacity={0.4} />
          {badgeLabel && (
            <Group x={6} y={36}>
              <Rect width={28} height={16} fill={badgeFill} cornerRadius={6} />
              <Text
                text={badgeLabel}
                fontSize={10}
                fontStyle="bold"
                fill={badgeTextColor}
                width={28}
                height={16}
                verticalAlign="middle"
                align="center"
              />
            </Group>
          )}
        </Group>
      );
    }

    return (
      <Group>
        <Rect x={4} y={4} width={30} height={24} cornerRadius={8} fill={baseFill} stroke={accent} strokeWidth={2} />
        <Circle x={19} y={16} radius={8} fill={accent} />
        <Circle x={19} y={16} radius={3.5} fill={baseFill} />
      </Group>
    );
  };

  if (category === 'switch') {
    const baseRadius = Math.min(width, height) / 2;
    const fillColor = '#1e3a8a';
    const strokeColor = isLinkingSource ? '#38bdf8' : isHovered ? '#93c5fd' : '#1d4ed8';
    const label =
      element.name?.trim() ||
      deriveSwitchLabel((element.metadata?.model as string | undefined) || 'Switch');
    return (
      <>
        <Circle
          x={width / 2}
          y={height / 2}
          radius={baseRadius}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={isLinkingSource ? 2.5 : isHovered ? 2 : 1.5}
        />
        <Text
          text={label}
          fontSize={16}
          fontStyle="bold"
          fill="#f8fafc"
          x={0}
          y={height / 2 - 10}
          width={width}
          align="center"
          wrap="none"
          ellipsis
        />
      </>
    );
  }

  return (
    <>
      <Rect
        width={width}
        height={height}
        cornerRadius={6}
        fill={statusConfig.nodeFill}
        stroke={isLinkingSource ? '#38bdf8' : isHovered ? '#f8fafc' : '#0b1120'}
        strokeWidth={isLinkingSource ? 2.5 : isHovered ? 2 : 1.5}
      />
      <Group x={12} y={14}>{renderTypeIcon()}</Group>
      <Text
        text={element.metadata?.ip ?? '待分配 IP'}
        fontSize={12}
        fill={statusConfig.secondaryTextColor}
        x={textOffsetX}
        y={18}
        width={textWidth}
        ellipsis
      />
      <Text
        text={element.name}
        fontSize={13}
        fontStyle="bold"
        fill={statusConfig.textColor}
        x={textOffsetX}
        y={36}
        width={textWidth}
        ellipsis
      />
    </>
  );
};
