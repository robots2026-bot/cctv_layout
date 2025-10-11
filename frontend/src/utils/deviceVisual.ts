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
    nodeFill: '#16a34a',
    panelBg: '#1a2e1c',
    textColor: '#ecfdf5',
    secondaryTextColor: '#bbf7d0'
  },
  offline: {
    fill: '#475569',
    label: '离线',
    nodeFill: '#1f2937',
    panelBg: '#111827',
    textColor: '#e2e8f0',
    secondaryTextColor: '#94a3b8'
  },
  warning: {
    fill: '#f97316',
    label: '告警',
    nodeFill: '#9a3412',
    panelBg: '#421f0a',
    textColor: '#fff7ed',
    secondaryTextColor: '#fed7aa'
  },
  unknown: {
    fill: '#475569',
    label: '离线',
    nodeFill: '#1f2937',
    panelBg: '#111827',
    textColor: '#e2e8f0',
    secondaryTextColor: '#94a3b8'
  }
};

export const getStatusVisual = (rawStatus?: string): StatusVisual => {
  const normalized = (rawStatus ?? 'unknown').toLowerCase();
  return STATUS_MAP[normalized] ?? STATUS_MAP.unknown;
};
