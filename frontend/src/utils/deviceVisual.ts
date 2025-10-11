export type DeviceCategory = 'camera' | 'bridge' | 'other';

export const getDeviceCategory = (type?: string): DeviceCategory => {
  const normalized = (type ?? '').toLowerCase();
  if (!normalized) {
    return 'other';
  }
  if (
    normalized.includes('bridge') ||
    normalized.includes('ap') ||
    normalized.includes('switch') ||
    normalized.includes('relay')
  ) {
    return 'bridge';
  }
  if (
    normalized.includes('camera') ||
    normalized.includes('cam') ||
    normalized.includes('ptz') ||
    normalized.includes('bullet') ||
    normalized.includes('dome')
  ) {
    return 'camera';
  }
  return 'other';
};

export interface StatusVisual {
  fill: string;
  label: string;
  opacity?: number;
  nodeFill: string;
  panelBg: string;
  textColor: string;
  secondaryTextColor: string;
}

const STATUS_MAP: Record<string, StatusVisual> = {
  online: {
    fill: '#16a34a',
    label: '在线',
    nodeFill: '#15803d',
    panelBg: '#1a2e1c',
    textColor: '#ecfdf5',
    secondaryTextColor: '#bbf7d0'
  },
  offline: {
    fill: '#94a3b8',
    label: '离线',
    nodeFill: '#1e293b',
    panelBg: '#1c1f26',
    textColor: '#e2e8f0',
    secondaryTextColor: '#cbd5f5'
  },
  unknown: {
    fill: '#fbbf24',
    label: '未知',
    opacity: 0.75,
    nodeFill: '#78350f',
    panelBg: '#2c1f0e',
    textColor: '#fef3c7',
    secondaryTextColor: '#fde68a'
  }
};

export const getStatusVisual = (rawStatus?: string): StatusVisual => {
  const normalized = (rawStatus ?? 'unknown').toLowerCase();
  return STATUS_MAP[normalized] ?? STATUS_MAP.unknown;
};
