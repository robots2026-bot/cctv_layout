import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  Point,
  Repository
} from 'typeorm';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  ProjectEntity,
  ProjectStage,
  ProjectStatus
} from './entities/project.entity';
import { ProjectMemberEntity } from './entities/project-member.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { DeleteProjectDto } from './dto/delete-project.dto';
import { RestoreProjectDto } from './dto/restore-project.dto';
import { ProjectBulkActionDto, ProjectBulkActionType } from './dto/project-bulk-action.dto';
import { RealtimeService } from '../realtime/realtime.service';

export interface ProjectListResponse {
  items: ProjectEntity[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  totals: {
    total: number;
    active: number;
    archived: number;
    deleted: number;
  };
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectsRepository: Repository<ProjectEntity>,
    @InjectRepository(ProjectMemberEntity)
    private readonly projectMembersRepository: Repository<ProjectMemberEntity>,
    private readonly activityLogService: ActivityLogService,
    private readonly realtimeService: RealtimeService
  ) {}

  async findAll(query: ProjectQueryDto): Promise<ProjectListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const baseQb = this.projectsRepository.createQueryBuilder('project').where('1=1');

    if (!query.includeDeleted) {
      baseQb.andWhere('project.status != :deleted', { deleted: ProjectStatus.DELETED });
    }
    if (query.status) {
      baseQb.andWhere('project.status = :status', { status: query.status });
    }
    if (query.stage) {
      baseQb.andWhere('project.stage = :stage', { stage: query.stage });
    }
    if (query.region) {
      baseQb.andWhere('project.region ILIKE :region', { region: `%${query.region}%` });
    }
    if (query.keyword) {
      const keyword = `%${query.keyword}%`;
      baseQb.andWhere('(project.name ILIKE :keyword OR project.code ILIKE :keyword)', { keyword });
    }

    const dataQb = baseQb.clone();
    dataQb.leftJoinAndSelect('project.members', 'members');
    dataQb.orderBy('project.updatedAt', 'DESC');
    dataQb.skip((page - 1) * pageSize);
    dataQb.take(pageSize);
    dataQb.loadRelationCountAndMap('project.layoutCount', 'project.layouts');
    dataQb.loadRelationCountAndMap('project.deviceCount', 'project.devices');

    const [projects, total] = await dataQb.getManyAndCount();

    const totalsRaw = await baseQb
      .clone()
      .select('project.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('project.status')
      .getRawMany<{ status: ProjectStatus; count: string }>();

    const totalsMap: Record<ProjectStatus, number> = {
      [ProjectStatus.ACTIVE]: 0,
      [ProjectStatus.ARCHIVED]: 0,
      [ProjectStatus.DELETED]: 0
    };
    for (const row of totalsRaw) {
      totalsMap[row.status] = Number(row.count);
    }

    return {
      items: projects,
      meta: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize)
      },
      totals: {
        total,
        active: totalsMap[ProjectStatus.ACTIVE],
        archived: totalsMap[ProjectStatus.ARCHIVED],
        deleted: totalsMap[ProjectStatus.DELETED]
      }
    };
  }

  async findOne(id: string): Promise<ProjectEntity> {
    const project = await this.projectsRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.members', 'members')
      .where('project.id = :id', { id })
      .loadRelationCountAndMap('project.layoutCount', 'project.layouts')
      .loadRelationCountAndMap('project.deviceCount', 'project.devices')
      .getOne();

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async create(dto: CreateProjectDto): Promise<ProjectEntity> {
    const existingCode = await this.projectsRepository.findOne({ where: { code: dto.code.toUpperCase() } });
    if (existingCode) {
      throw new ConflictException(`Project code ${dto.code} already exists`);
    }

    const locationGeo = this.resolveLocationPoint(dto.location);

    const project = this.projectsRepository.create({
      code: dto.code.toUpperCase(),
      name: dto.name,
      region: dto.region ?? null,
      locationText: dto.location?.text ?? null,
      locationGeo,
      stage: dto.stage ?? ProjectStage.PLANNING,
      status: ProjectStatus.ACTIVE,
      plannedOnlineAt: dto.plannedOnlineAt ? new Date(dto.plannedOnlineAt) : null,
      description: dto.description ?? null,
      layoutCountCache: 0,
      deviceCountCache: 0,
      createdBy: dto.createdBy ?? null
    });

    const saved = await this.projectsRepository.save(project);

    if (dto.includeDefaultMembership && dto.createdBy) {
      await this.ensureDefaultMembership(saved.id, dto.createdBy);
    }

    await this.activityLogService.record({
      projectId: saved.id,
      action: 'project.created'
    });
    this.realtimeService.emitProjectsUpdated({
      projectId: saved.id,
      action: 'created'
    });
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectEntity> {
    const project = await this.findOne(id);

    if (dto.code && dto.code.toUpperCase() !== project.code) {
      const exists = await this.projectsRepository.findOne({ where: { code: dto.code.toUpperCase() } });
      if (exists) {
        throw new ConflictException(`Project code ${dto.code} already exists`);
      }
      project.code = dto.code.toUpperCase();
    }

    if (dto.name) {
      project.name = dto.name;
    }
    if (dto.region !== undefined) {
      project.region = dto.region ?? null;
    }
    if (dto.location) {
      project.locationText = dto.location.text ?? null;
      project.locationGeo = this.resolveLocationPoint(dto.location);
    }
    if (dto.stage) {
      project.stage = dto.stage;
    }
    if (dto.plannedOnlineAt !== undefined) {
      project.plannedOnlineAt = dto.plannedOnlineAt ? new Date(dto.plannedOnlineAt) : null;
    }
    if (dto.description !== undefined) {
      project.description = dto.description ?? null;
    }

    let action: string = 'project.updated';

    if (dto.status && dto.status !== project.status) {
      if (dto.status === ProjectStatus.DELETED) {
        project.status = ProjectStatus.DELETED;
        project.deletedAt = new Date();
        action = 'project.deleted';
      } else {
        project.status = dto.status;
        project.deletedAt = null;
        action = dto.status === ProjectStatus.ARCHIVED ? 'project.archived' : 'project.updated';
      }
    }

    const saved = await this.projectsRepository.save(project);

    await this.activityLogService.record({
      projectId: saved.id,
      action
    });
    this.realtimeService.emitProjectsUpdated({
      projectId: saved.id,
      action: action.replace('project.', '') as 'created' | 'updated' | 'archived' | 'deleted' | 'restored'
    });

    return this.findOne(saved.id);
  }

  async softDelete(id: string, dto: DeleteProjectDto): Promise<void> {
    const project = await this.findOne(id);
    if (project.status === ProjectStatus.DELETED) {
      return;
    }
    project.status = ProjectStatus.DELETED;
    project.deletedAt = new Date();
    await this.projectsRepository.save(project);

    await this.activityLogService.record({
      projectId: id,
      action: 'project.deleted',
      details: {
        reason: dto.reason ?? null,
        options: {
          archiveLayouts: dto.archiveLayouts ?? true,
          keepDeviceMappings: dto.keepDeviceMappings ?? true
        }
      }
    });
    this.realtimeService.emitProjectsUpdated({
      projectId: id,
      action: 'deleted'
    });
    // TODO: integrate layout archiving and device detaching pipelines
  }

  async restore(id: string, dto: RestoreProjectDto): Promise<ProjectEntity> {
    const project = await this.findOne(id);
    project.status = ProjectStatus.ACTIVE;
    project.deletedAt = null;
    const saved = await this.projectsRepository.save(project);
    await this.activityLogService.record({
      projectId: saved.id,
      action: 'project.restored',
      details: {
        reason: dto.reason ?? null
      }
    });
    this.realtimeService.emitProjectsUpdated({
      projectId: saved.id,
      action: 'restored'
    });
    return this.findOne(saved.id);
  }

  async bulkAction(dto: ProjectBulkActionDto): Promise<{ affected: number }> {
    const projects = await this.projectsRepository.find({
      where: { id: In(dto.ids) }
    });
    if (projects.length !== dto.ids.length) {
      throw new NotFoundException('部分项目不存在，无法执行批量操作');
    }

    switch (dto.action) {
      case ProjectBulkActionType.ARCHIVE: {
        for (const project of projects) {
          project.status = ProjectStatus.ARCHIVED;
        }
        await this.projectsRepository.save(projects);
        for (const project of projects) {
          await this.activityLogService.record({
            projectId: project.id,
            action: 'project.archived'
          });
          this.realtimeService.emitProjectsUpdated({
            projectId: project.id,
            action: 'archived'
          });
        }
        break;
      }
      case ProjectBulkActionType.RESTORE: {
        for (const project of projects) {
          project.status = ProjectStatus.ACTIVE;
          project.deletedAt = null;
        }
        await this.projectsRepository.save(projects);
        for (const project of projects) {
          await this.activityLogService.record({
            projectId: project.id,
            action: 'project.restored'
          });
          this.realtimeService.emitProjectsUpdated({
            projectId: project.id,
            action: 'restored'
          });
        }
        break;
      }
      default:
        break;
    }

    return { affected: projects.length };
  }

  private resolveLocationPoint(
    location?: { lat?: number; lng?: number }
  ):
    | {
        x: number;
        y: number;
      }
    | null {
    if (
      !location ||
      typeof location.lat !== 'number' ||
      typeof location.lng !== 'number'
    ) {
      return null;
    }
    return {
      x: location.lng,
      y: location.lat
    };
  }

  private async ensureDefaultMembership(projectId: string, userId: string) {
    const exists = await this.projectMembersRepository.findOne({
      where: {
        projectId,
        userId
      }
    });
    if (exists) {
      return;
    }
    const member = this.projectMembersRepository.create({
      projectId,
      userId,
      role: 'owner'
    });
    await this.projectMembersRepository.save(member);
  }
}
