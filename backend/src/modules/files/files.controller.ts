import { Controller, Get, Param } from '@nestjs/common';
import { FilesService } from './files.service';

@Controller('projects/:projectId/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get('upload-url')
  generateUploadUrl(@Param('projectId') projectId: string) {
    return this.filesService.generateUploadUrl(projectId);
  }
}
