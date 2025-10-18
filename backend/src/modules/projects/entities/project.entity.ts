import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { LayoutEntity } from '../../layouts/entities/layout.entity';
import { DeviceEntity } from '../../devices/entities/device.entity';
import { ActivityLogEntity } from '../../activity-log/entities/activity-log.entity';
import { ProjectMemberEntity } from './project-member.entity';
import { ProjectFileEntity } from '../../files/entities/project-file.entity';

export enum ProjectStage {
  PLANNING = 'planning',
  CONSTRUCTION = 'construction',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export enum ProjectStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

@Entity({ name: 'projects' })
@Index('idx_projects_status_stage', ['status', 'stage'])
@Index('idx_projects_deleted_at', ['deletedAt'])
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'smallint', unique: true })
  code!: number;

  @Column({ length: 120 })
  name!: string;

  @Column({ name: 'region', nullable: true, length: 120, type: 'varchar' })
  region?: string | null;

  @Column({ name: 'location_text', nullable: true, length: 255, type: 'varchar' })
  locationText?: string | null;

  @Column({ name: 'location_geo', type: 'point', nullable: true })
  locationGeo?: { x: number; y: number } | null;

  @Column({ type: 'enum', enum: ProjectStage, default: ProjectStage.PLANNING })
  @Index('idx_projects_stage')
  stage!: ProjectStage;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  @Index('idx_projects_status')
  status!: ProjectStatus;

  @Column({ name: 'planned_online_at', type: 'timestamptz', nullable: true })
  plannedOnlineAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'default_layout_id', type: 'uuid', nullable: true })
  defaultLayoutId?: string | null;

  @Column({ name: 'layout_count_cache', type: 'int', default: 0 })
  layoutCountCache!: number;

  @Column({ name: 'device_count_cache', type: 'int', default: 0 })
  deviceCountCache!: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => LayoutEntity, (layout) => layout.project)
  layouts!: LayoutEntity[];

  @OneToMany(() => DeviceEntity, (device) => device.project)
  devices!: DeviceEntity[];

  @OneToMany(() => ActivityLogEntity, (log) => log.project)
  logs!: ActivityLogEntity[];

  @OneToMany(() => ProjectMemberEntity, (member) => member.project)
  members!: ProjectMemberEntity[];

  @OneToMany(() => ProjectFileEntity, (file) => file.project)
  files!: ProjectFileEntity[];

  layoutCount?: number;
  deviceCount?: number;
}
