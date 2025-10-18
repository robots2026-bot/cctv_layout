import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { CreatePresignedUploadDto } from './dto/create-presigned-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import {
  ProjectFileEntity,
  ProjectFileCategory,
  ProjectFileStatus
} from './entities/project-file.entity';
import { ObjectStorageConfig } from '../../config/object-storage.config';
import { LayoutEntity } from '../layouts/entities/layout.entity';

const CATEGORY_SIZE_LIMIT: Record<ProjectFileCategory, number> = {
  blueprint: 20 * 1024 * 1024,
  background: 15 * 1024 * 1024,
  export: 50 * 1024 * 1024,
  other: 10 * 1024 * 1024
};

export interface PresignedUploadResponse {
  fileId: string;
  uploadUrl: string;
  expiresIn: number;
  headers: Record<string, string>;
  objectKey: string;
}

export interface ProjectFileMetadata {
  id: string;
  projectId: string;
  layoutId?: string | null;
  category: ProjectFileCategory;
  url: string;
  objectKey: string;
  mimeType: string;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  etag?: string | null;
  status: ProjectFileStatus;
}

@Injectable()
export class FilesService {
  private readonly s3: S3Client;
  private readonly presignClient: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;
  private readonly publicUploadEndpoint?: string;
  private readonly presignExpiresIn: number;
  private readonly environment: string;

  constructor(
    @InjectRepository(ProjectFileEntity)
    private readonly filesRepository: Repository<ProjectFileEntity>,
    private readonly configService: ConfigService
  ) {
    const objectStorage = this.configService.getOrThrow<ObjectStorageConfig>('objectStorage');
    const baseClientConfig = {
      region: objectStorage.region,
      forcePathStyle: objectStorage.forcePathStyle,
      credentials: {
        accessKeyId: objectStorage.accessKeyId,
        secretAccessKey: objectStorage.secretAccessKey
      }
    } as const;

    this.s3 = new S3Client({
      ...baseClientConfig,
      endpoint: objectStorage.endpoint
    });

    this.presignClient = new S3Client({
      ...baseClientConfig,
      endpoint: objectStorage.publicUploadEndpoint ?? objectStorage.endpoint
    });
    this.bucket = objectStorage.bucket;
    this.publicBaseUrl = objectStorage.publicBaseUrl
      ? objectStorage.publicBaseUrl.replace(/\/$/, '')
      : undefined;
    this.publicUploadEndpoint = objectStorage.publicUploadEndpoint
      ? objectStorage.publicUploadEndpoint.replace(/\/$/, '')
      : undefined;
    this.presignExpiresIn = objectStorage.presignExpiresIn;
    this.environment = this.configService.get<string>('app.environment') ?? 'development';
  }

  private resolveSizeLimit(category: ProjectFileCategory) {
    return CATEGORY_SIZE_LIMIT[category] ?? CATEGORY_SIZE_LIMIT.other;
  }

  private sanitizeExtension(fileName: string) {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) {
      return '';
    }
    const raw = fileName.substring(lastDot + 1).toLowerCase();
    const cleaned = raw.replace(/[^a-z0-9]/g, '');
    return cleaned ? `.${cleaned}` : '';
  }

  private buildObjectKey(projectId: string, category: ProjectFileCategory, fileName: string) {
    const now = new Date();
    const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(
      now.getUTCDate()
    ).padStart(2, '0')}`;
    const extension = this.sanitizeExtension(fileName);
    const safeCategory = category ?? 'other';
    return `${this.environment}/${projectId}/${safeCategory}/${folder}/${uuid()}${extension}`;
  }

  private buildPublicUrl(objectKey: string) {
    if (!this.publicBaseUrl) {
      return undefined;
    }
    return `${this.publicBaseUrl}/${objectKey}`;
  }

  private async generateDownloadUrl(objectKey: string) {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: objectKey });
    return getSignedUrl(this.s3, command, {
      expiresIn: this.presignExpiresIn
    });
  }

  async createPresignedUpload(
    projectId: string,
    dto: CreatePresignedUploadDto,
    userId?: string
  ): Promise<PresignedUploadResponse> {
    const maxSize = this.resolveSizeLimit(dto.category);
    if (dto.sizeBytes > maxSize) {
      throw new BadRequestException(
        `文件过大，当前类型限制为 ${(maxSize / (1024 * 1024)).toFixed(1)} MB`
      );
    }

    if (dto.layoutId) {
      const layout = await this.filesRepository.manager.findOne(LayoutEntity, {
        where: { id: dto.layoutId, projectId }
      });
      if (!layout) {
        throw new BadRequestException('指定的布局不存在或不属于当前项目');
      }
    }

    const objectKey = this.buildObjectKey(projectId, dto.category, dto.fileName);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: dto.mimeType
    });
    const signingClient = this.presignClient ?? this.s3;
    const uploadUrl = await getSignedUrl(signingClient, command, {
      expiresIn: this.presignExpiresIn
    });

    const record = this.filesRepository.create({
      projectId,
      layoutId: dto.layoutId ?? null,
      category: dto.category,
      objectKey,
      filename: dto.fileName,
      mimeType: dto.mimeType,
      status: 'pending_upload',
      createdBy: userId ?? null
    });
    const saved = await this.filesRepository.save(record);

    return {
      fileId: saved.id,
      uploadUrl,
      expiresIn: this.presignExpiresIn,
      headers: {
        'Content-Type': dto.mimeType
      },
      objectKey
    };
  }

  async completeUpload(
    projectId: string,
    fileId: string,
    dto: CompleteUploadDto
  ): Promise<ProjectFileMetadata> {
    const entity = await this.filesRepository.findOne({
      where: { id: fileId, projectId }
    });
    if (!entity) {
      throw new NotFoundException(`文件 ${fileId} 不存在或不属于当前项目`);
    }
    if (entity.status !== 'pending_upload') {
      throw new BadRequestException('文件状态异常，无法完成上传');
    }

    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: entity.objectKey }));
    } catch (error) {
      throw new BadRequestException('对象存储未找到该文件，请重新上传');
    }

    entity.status = 'available';
    entity.sizeBytes = dto.sizeBytes.toString();
    entity.width = dto.width ?? null;
    entity.height = dto.height ?? null;
    entity.etag = dto.etag ?? null;
    entity.publicUrl = this.buildPublicUrl(entity.objectKey) ?? null;

    await this.filesRepository.save(entity);

    const url = entity.publicUrl ?? (await this.generateDownloadUrl(entity.objectKey));

    return {
      id: entity.id,
      projectId: entity.projectId,
      layoutId: entity.layoutId ?? null,
      category: entity.category,
      url,
      objectKey: entity.objectKey,
      mimeType: entity.mimeType,
      sizeBytes: Number(entity.sizeBytes ?? 0) || null,
      width: entity.width ?? null,
      height: entity.height ?? null,
      etag: entity.etag ?? null,
      status: entity.status
    };
  }

  async getFileMetadata(projectId: string, fileId: string): Promise<ProjectFileMetadata> {
    const entity = await this.filesRepository.findOne({
      where: { id: fileId, projectId }
    });
    if (!entity) {
      throw new NotFoundException(`文件 ${fileId} 不存在`);
    }
    const url = entity.publicUrl ?? (await this.generateDownloadUrl(entity.objectKey));
    return {
      id: entity.id,
      projectId: entity.projectId,
      layoutId: entity.layoutId ?? null,
      category: entity.category,
      url,
      objectKey: entity.objectKey,
      mimeType: entity.mimeType,
      sizeBytes: entity.sizeBytes ? Number(entity.sizeBytes) : null,
      width: entity.width ?? null,
      height: entity.height ?? null,
      etag: entity.etag ?? null,
      status: entity.status
    };
  }

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    const entity = await this.filesRepository.findOne({
      where: { id: fileId, projectId }
    });
    if (!entity) {
      throw new NotFoundException(`文件 ${fileId} 不存在`);
    }

    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: entity.objectKey
      })
    );
    entity.status = 'deleted';
    await this.filesRepository.save(entity);
  }
}
