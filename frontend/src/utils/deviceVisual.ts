export type DeviceCategory = 'camera' | 'bridge' | 'switch' | 'other';
export interface DeviceTypeVisual {
  label: string;
  accent: string;
  background: string;
  text: string;
}

export const getDeviceCategory = (type?: string): DeviceCategory => {
  const normalized = (type ?? '').toLowerCase();
  if (!normalized) {
    return 'other';
  }
  if (normalized.includes('switch') || normalized.includes('v600') || normalized.includes('交换机')) {
    return 'switch';
  }
  if (
    normalized.includes('bridge') ||
    normalized.includes('ap') ||
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

const DEVICE_TYPE_MAP: Record<string, DeviceTypeVisual> = {
  camera: { label: '摄像机', accent: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', text: '#bae6fd' },
  nvr: { label: 'NVR 录像机', accent: '#facc15', background: 'rgba(250, 204, 21, 0.12)', text: '#fef08a' },
  bridge: { label: '无线网桥', accent: '#c084fc', background: 'rgba(192, 132, 252, 0.12)', text: '#e9d5ff' },
  switch: { label: '交换机', accent: '#34d399', background: 'rgba(52, 211, 153, 0.12)', text: '#bbf7d0' },
  other: { label: '其他设备', accent: '#94a3b8', background: 'rgba(148, 163, 184, 0.12)', text: '#cbd5f5' }
};

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
    fill: '#94a3b8',
    label: '离线',
    nodeFill: '#374151',
    panelBg: '#111827',
    textColor: '#e5e7eb',
    secondaryTextColor: '#cbd5f5'
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
    fill: '#94a3b8',
    label: '离线',
    nodeFill: '#374151',
    panelBg: '#111827',
    textColor: '#e5e7eb',
    secondaryTextColor: '#cbd5f5'
  }
};

export const getStatusVisual = (rawStatus?: string): StatusVisual => {
  const normalized = (rawStatus ?? 'unknown').toLowerCase();
  return STATUS_MAP[normalized] ?? STATUS_MAP.unknown;
};

export const getDeviceTypeVisual = (type?: string): DeviceTypeVisual => {
  const normalized = (type ?? '').toLowerCase();
  if (normalized.includes('camera')) return DEVICE_TYPE_MAP.camera;
  if (normalized.includes('nvr')) return DEVICE_TYPE_MAP.nvr;
  if (normalized.includes('switch') || normalized.includes('v600') || normalized.includes('交换机'))
    return DEVICE_TYPE_MAP.switch;
  if (normalized.includes('bridge')) return DEVICE_TYPE_MAP.bridge;
  return DEVICE_TYPE_MAP.other;
};

export const deriveSwitchLabel = (raw?: string): string => {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 'TC';
  const match = trimmed.match(/TC\d+/i);
  if (match) {
    return match[0].toUpperCase();
  }
  return trimmed.length <= 4 ? trimmed : trimmed.slice(0, 4);
};
