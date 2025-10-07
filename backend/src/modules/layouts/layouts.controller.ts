import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { LayoutsService } from './layouts.service';
import { CreateLayoutDto } from './dto/create-layout.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';
import { SaveLayoutVersionDto } from './dto/save-layout-version.dto';

@Controller()
export class LayoutsController {
  constructor(private readonly layoutsService: LayoutsService) {}

  @Get('projects/:projectId/layouts')
  list(@Param('projectId') projectId: string) {
    return this.layoutsService.listProjectLayouts(projectId);
  }

  @Get('layouts/:layoutId')
  detail(@Param('layoutId') layoutId: string) {
    return this.layoutsService.findOne(layoutId);
  }

  @Post('layouts')
  create(@Body() dto: CreateLayoutDto) {
    return this.layoutsService.create(dto);
  }

  @Put('layouts/:layoutId')
  update(@Param('layoutId') layoutId: string, @Body() dto: UpdateLayoutDto) {
    return this.layoutsService.update(layoutId, dto);
  }

  @Post('layouts/:layoutId/versions')
  saveVersion(@Param('layoutId') layoutId: string, @Body() dto: SaveLayoutVersionDto) {
    return this.layoutsService.saveVersion(layoutId, dto);
  }
}
