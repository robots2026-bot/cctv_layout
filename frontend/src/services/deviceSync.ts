import { apiClient } from '../utils/apiClient';

export type DeviceSyncStatus = 'online' | 'offline' | 'warning' | 'unknown';

export type DeviceSyncType = 'Camera' | 'NVR' | 'Bridge' | 'Switch';

export interface DeviceSyncDevice {
  mac: string;
  type: DeviceSyncType;
  name?: string;
  model?: string;
  ip?: string;
  statuses?: string[];
  latencyMs?: number;
  packetLoss?: number;
  metrics?: Record<string, unknown>;
  bridgeRole?: 'AP' | 'ST' | 'UNKNOWN' | string;
}

export interface DeviceSyncRequest {
  projectCode: number;
  gatewayMac: string;
  gatewayIp?: string;
  scannedAt?: string;
  devices: DeviceSyncDevice[];
}

export interface DeviceSyncResponse {
  processed: number;
  failed: Array<{ deviceId?: string; mac?: string; reason: string }>;
}

export const postDeviceSync = async (payload: DeviceSyncRequest) => {
  const response = await apiClient.post<DeviceSyncResponse | Record<string, unknown>>('/device-sync', payload);
  return response.data;
};
