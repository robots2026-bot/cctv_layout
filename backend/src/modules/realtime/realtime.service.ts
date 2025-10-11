import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { DeviceEntity } from '../devices/entities/device.entity';

@Injectable()
export class RealtimeService {
  private server?: Server;
  private readonly logger = new Logger(RealtimeService.name);

  registerServer(server: Server) {
    this.server = server;
  }

  emitDeviceUpdate(device: DeviceEntity) {
    if (!this.server) {
      this.logger.warn('Attempted to emit device update without an active server');
      return;
    }
    this.server.to(`project:${device.projectId}`).emit('device.update', {
      id: device.id,
      name: device.name,
      type: device.type,
      ip: device.ipAddress,
      status: device.status
    });
  }

  emitLayoutVersion(projectId: string, payload: { layoutId: string; versionId: string }) {
    if (!this.server) {
      this.logger.warn('Attempted to emit layout update without an active server');
      return;
    }
    this.server.to(`project:${projectId}`).emit('layout.version', payload);
  }

  emitProjectsUpdated(payload: { projectId: string; action: 'created' | 'updated' | 'archived' | 'deleted' | 'restored' }) {
    if (!this.server) {
      this.logger.warn('Attempted to emit project update without an active server');
      return;
    }
    this.server.emit('projects.updated', payload);
  }
}
