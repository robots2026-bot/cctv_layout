export interface CanvasElement {
  id: string;
  name: string;
  type: string;
  deviceId?: string;
  deviceMac?: string | null;
  metadata?: {
    ip?: string;
    [key: string]: unknown;
  };
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  selected: boolean;
}

export interface ConnectionBandwidth {
  upstreamMbps?: number;
  downstreamMbps?: number;
}

export type ConnectionStatus = 'online' | 'offline' | 'warning';

export type ConnectionKind = 'wired' | 'wireless';

export interface CanvasConnection {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  kind: ConnectionKind;
  fromDeviceId?: string;
  toDeviceId?: string;
  bandwidth?: ConnectionBandwidth;
  status?: ConnectionStatus;
  selected?: boolean;
}

export interface CanvasViewport {
  width: number;
  height: number;
  scale: number;
  position: { x: number; y: number };
}

export interface CanvasBlueprint {
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  scale: number;
  opacity: number;
  offset: { x: number; y: number };
  fileId?: string | null;
}

export interface CanvasLayout {
  id: string;
  name: string;
  projectId: string;
  background?: {
    url: string | null;
  } | null;
  blueprint?: CanvasBlueprint | null;
  elements: CanvasElement[];
  connections: CanvasConnection[];
}

export interface DeviceSummary {
  id: string;
  mac: string | null;
  alias?: string | null;
  name: string;
  type: string;
  ip?: string;
  model?: string;
  status?: 'online' | 'offline' | 'warning' | 'unknown';
  metadata?: Record<string, unknown> | null;
  bridgeRole?: 'AP' | 'ST' | 'UNKNOWN';
}
