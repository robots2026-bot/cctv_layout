import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { ProjectEntity } from '../../projects/entities/project.entity';
import { LayoutEntity } from '../../layouts/entities/layout.entity';

export type ProjectFileCategory = 'blueprint' | 'background' | 'export' | 'other';
export type ProjectFileStatus = 'pending_upload' | 'available' | 'deleted';

@Entity({ name: 'project_files' })
@Index('idx_project_files_project_id', ['projectId'])
@Index('idx_project_files_layout_id', ['layoutId'])
@Index('idx_project_files_status', ['status'])
export class ProjectFileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => ProjectEntity, (project) => project.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: ProjectEntity;

  @Column({ name: 'layout_id', type: 'uuid', nullable: true })
  layoutId?: string | null;

  @ManyToOne(() => LayoutEntity, (layout) => layout.files, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'layout_id' })
  layout?: LayoutEntity | null;

  @Column({ type: 'varchar', length: 32 })
  category!: ProjectFileCategory;

  @Column({ name: 'object_key', type: 'text' })
  objectKey!: string;

  @Column({ type: 'text' })
  filename!: string;

  @Column({ name: 'mime_type', type: 'text' })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes?: string | null;

  @Column({ type: 'integer', nullable: true })
  width?: number | null;

  @Column({ type: 'integer', nullable: true })
  height?: number | null;

  @Column({ type: 'text', default: 'pending_upload' })
  status!: ProjectFileStatus;

  @Column({ type: 'text', nullable: true })
  etag?: string | null;

  @Column({ type: 'text', nullable: true })
  checksum?: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
