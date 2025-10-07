import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { ProjectEntity } from '../../projects/entities/project.entity';
import { LayoutVersionEntity } from './layout-version.entity';

@Entity({ name: 'layouts' })
export class LayoutEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ProjectEntity, (project) => project.layouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: ProjectEntity;

  @Column({ name: 'project_id' })
  projectId!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ name: 'background_image_url', nullable: true })
  backgroundImageUrl?: string | null;

  @Column({ name: 'background_opacity', type: 'float', default: 0.6 })
  backgroundOpacity!: number;

  @OneToMany(() => LayoutVersionEntity, (version) => version.layout)
  versions!: LayoutVersionEntity[];

  @Column({ name: 'current_version_id', nullable: true })
  currentVersionId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
