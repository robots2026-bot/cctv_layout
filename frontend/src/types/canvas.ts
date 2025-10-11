export interface CanvasElement {
  id: string;
  name: string;
  type: string;
  deviceId?: string;
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

export interface CanvasConnection {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  kind: 'wired' | 'wireless';
}

export interface CanvasViewport {
  width: number;
  height: number;
  scale: number;
  position: { x: number; y: number };
}

export interface CanvasLayout {
  id: string;
  name: string;
  projectId: string;
  background?: {
    url: string | null;
  } | null;
  elements: CanvasElement[];
  connections: CanvasConnection[];
}

export interface DeviceSummary {
  id: string;
  name: string;
  type: string;
  ip?: string;
  status?: 'online' | 'offline' | 'unknown';
}
