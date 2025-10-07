import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectsRepository: Repository<ProjectEntity>,
    private readonly activityLogService: ActivityLogService
  ) {}

  async findAll(): Promise<ProjectEntity[]> {
    return this.projectsRepository.find({
      order: { updatedAt: 'DESC' },
      relations: ['layouts']
    });
  }

  async findOne(id: string): Promise<ProjectEntity> {
    const project = await this.projectsRepository.findOne({
      where: { id },
      relations: ['layouts']
    });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async create(dto: CreateProjectDto): Promise<ProjectEntity> {
    const project = this.projectsRepository.create(dto);
    const saved = await this.projectsRepository.save(project);
    await this.activityLogService.record({
      projectId: saved.id,
      action: 'project.create'
    });
    return saved;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectEntity> {
    const project = await this.findOne(id);
    Object.assign(project, dto);
    const saved = await this.projectsRepository.save(project);
    await this.activityLogService.record({
      projectId: saved.id,
      action: 'project.update'
    });
    return saved;
  }

  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);
    await this.projectsRepository.remove(project);
    await this.activityLogService.record({
      projectId: id,
      action: 'project.delete'
    });
  }
}
