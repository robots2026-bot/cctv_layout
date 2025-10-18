import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { FilesService } from './files.service';
import { CreatePresignedUploadDto } from './dto/create-presigned-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

@Controller('projects/:projectId/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign')
  createPresignedUpload(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePresignedUploadDto
  ) {
    return this.filesService.createPresignedUpload(projectId, dto);
  }

  @Post(':fileId/complete')
  completeUpload(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @Body() dto: CompleteUploadDto
  ) {
    return this.filesService.completeUpload(projectId, fileId, dto);
  }

  @Get(':fileId')
  getFileMetadata(@Param('projectId') projectId: string, @Param('fileId') fileId: string) {
    return this.filesService.getFileMetadata(projectId, fileId);
  }

  @Delete(':fileId')
  async deleteFile(@Param('projectId') projectId: string, @Param('fileId') fileId: string) {
    await this.filesService.deleteFile(projectId, fileId);
    return { success: true };
  }
}
