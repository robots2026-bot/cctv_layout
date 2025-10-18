import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LayoutEntity } from './entities/layout.entity';
import { CreateLayoutDto } from './dto/create-layout.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';
import { LayoutVersionEntity } from './entities/layout-version.entity';
import { SaveLayoutVersionDto } from './dto/save-layout-version.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ProjectEntity } from '../projects/entities/project.entity';
import { FilesService } from '../files/files.service';
import type { ProjectFileMetadata } from '../files/files.service';

export interface LayoutDetail {
  id: string;
  projectId: string;
  name: string;
  backgroundOpacity: number;
  background: { url: string | null; opacity: number } | null;
  elements: Record<string, unknown>[];
  connections: Record<string, unknown>[];
  blueprint: Record<string, unknown> | null;
}

@Injectable()
export class LayoutsService {
  constructor(
    @InjectRepository(LayoutEntity)
    private readonly layoutsRepository: Repository<LayoutEntity>,
    @InjectRepository(LayoutVersionEntity)
    private readonly versionsRepository: Repository<LayoutVersionEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectsRepository: Repository<ProjectEntity>,
    private readonly activityLogService: ActivityLogService,
    private readonly realtimeService: RealtimeService,
    private readonly filesService: FilesService
  ) {}

  async listProjectLayouts(projectId: string) {
    return this.layoutsRepository.find({
      where: { projectId },
      order: { updatedAt: 'DESC' }
    });
  }

  async findOne(id: string): Promise<LayoutDetail> {
    const layout = await this.layoutsRepository.findOne({ where: { id } });
    if (!layout) {
      throw new NotFoundException(`Layout ${id} not found`);
    }
    const latestVersion = await this.versionsRepository.findOne({
      where: { layoutId: id },
      order: { versionNo: 'DESC' }
    });
    const elements = Array.isArray(latestVersion?.elementsJson)
      ? (latestVersion?.elementsJson as Record<string, unknown>[])
      : [];
    const connections = Array.isArray(latestVersion?.connectionsJson)
      ? (latestVersion?.connectionsJson as Record<string, unknown>[])
      : [];
    const metadata =
      latestVersion?.metadataJson && typeof latestVersion.metadataJson === 'object'
        ? (latestVersion.metadataJson as Record<string, unknown>)
        : null;
    let blueprint: Record<string, unknown> | null = null;
    if (metadata && typeof metadata.blueprint === 'object') {
      blueprint = { ...(metadata.blueprint as Record<string, unknown>) };
      const fileId = typeof blueprint.fileId === 'string' ? blueprint.fileId : null;
      if (fileId) {
        try {
          const fileMetadata: ProjectFileMetadata = await this.filesService.getFileMetadata(
            layout.projectId,
            fileId
          );
          blueprint.url = fileMetadata.url;
          if (!blueprint.naturalWidth && fileMetadata.width) {
            blueprint.naturalWidth = fileMetadata.width;
          }
          if (!blueprint.naturalHeight && fileMetadata.height) {
            blueprint.naturalHeight = fileMetadata.height;
          }
        } catch (error) {
          blueprint.url = null;
        }
      }
    }
    return {
      id: layout.id,
      projectId: layout.projectId,
      name: layout.name,
      backgroundOpacity: layout.backgroundOpacity,
      background: layout.backgroundImageUrl
        ? { url: layout.backgroundImageUrl, opacity: layout.backgroundOpacity }
        : null,
      elements,
      connections,
      blueprint
    };
  }

  async create(dto: CreateLayoutDto) {
    const layout = this.layoutsRepository.create({
      projectId: dto.projectId,
      name: dto.name,
      backgroundImageUrl: dto.backgroundImageUrl
    });
    const saved = await this.layoutsRepository.save(layout);

    await this.projectsRepository
      .createQueryBuilder()
      .update(ProjectEntity)
      .set({ defaultLayoutId: saved.id })
      .where('id = :projectId', { projectId: dto.projectId })
      .andWhere('default_layout_id IS NULL')
      .execute();

    await this.activityLogService.record({
      projectId: saved.projectId,
      action: 'layout.create',
      details: { layoutId: saved.id }
    });
    return saved;
  }

  async update(id: string, dto: UpdateLayoutDto) {
    const entity = await this.layoutsRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Layout ${id} not found`);
    }
    Object.assign(entity, dto);
    const saved = await this.layoutsRepository.save(entity);
    await this.activityLogService.record({
      projectId: saved.projectId,
      action: 'layout.update',
      details: { layoutId: saved.id }
    });
    return saved;
  }

  async saveVersion(layoutId: string, dto: SaveLayoutVersionDto, userId?: string) {
    const layoutEntity = await this.layoutsRepository.findOne({ where: { id: layoutId } });
    if (!layoutEntity) {
      throw new NotFoundException(`Layout ${layoutId} not found`);
    }
    const previous = await this.versionsRepository.findOne({
      where: { layoutId },
      order: { versionNo: 'DESC' }
    });
    const nextVersion = this.versionsRepository.create({
      layoutId,
      versionNo: (previous?.versionNo ?? 0) + 1,
      elementsJson: dto.elements,
      connectionsJson: dto.connections,
      metadataJson: dto.metadata ?? null,
      createdBy: userId ?? null
    });
    const saved = await this.versionsRepository.save(nextVersion);
    layoutEntity.currentVersionId = saved.id;
    if (dto.backgroundImageUrl !== undefined) {
      layoutEntity.backgroundImageUrl = dto.backgroundImageUrl;
    }
    layoutEntity.updatedAt = new Date();
    await this.layoutsRepository.save(layoutEntity);
    await this.activityLogService.record({
      projectId: layoutEntity.projectId,
      userId,
      action: 'layout.version.create',
      details: { layoutId, versionId: saved.id }
    });
    this.realtimeService.emitLayoutVersion(layoutEntity.projectId, {
      layoutId,
      versionId: saved.id
    });
    return saved;
  }
}
