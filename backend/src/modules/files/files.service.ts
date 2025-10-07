import { Injectable } from '@nestjs/common';

@Injectable()
export class FilesService {
  async generateUploadUrl(projectId: string) {
    // TODO: integrate with actual object storage provider
    return {
      uploadUrl: `https://storage.local/${projectId}/${Date.now()}`,
      expiresIn: 900
    };
  }
}
