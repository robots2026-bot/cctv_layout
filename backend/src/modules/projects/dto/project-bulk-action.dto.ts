import { ArrayNotEmpty, IsEnum, IsUUID } from 'class-validator';

export enum ProjectBulkActionType {
  ARCHIVE = 'archive',
  RESTORE = 'restore'
}

export class ProjectBulkActionDto {
  @IsEnum(ProjectBulkActionType)
  action!: ProjectBulkActionType;

  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids!: string[];
}
