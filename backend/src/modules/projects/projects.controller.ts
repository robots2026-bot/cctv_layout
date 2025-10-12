import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProjectDetailResponse, ProjectListResponse, ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { DeleteProjectDto } from './dto/delete-project.dto';
import { RestoreProjectDto } from './dto/restore-project.dto';
import { ProjectBulkActionDto } from './dto/project-bulk-action.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Query() query: ProjectQueryDto): Promise<ProjectListResponse> {
    return this.projectsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ProjectDetailResponse> {
    return this.projectsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProjectDto): Promise<ProjectDetailResponse> {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto): Promise<ProjectDetailResponse> {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Body() dto: DeleteProjectDto) {
    return this.projectsService.softDelete(id, dto);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @Body() dto: RestoreProjectDto): Promise<ProjectDetailResponse> {
    return this.projectsService.restore(id, dto);
  }

  @Post('bulk')
  bulk(@Body() dto: ProjectBulkActionDto) {
    return this.projectsService.bulkAction(dto);
  }
}
