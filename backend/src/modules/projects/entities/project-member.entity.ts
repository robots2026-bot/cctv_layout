import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm';
import { ProjectEntity } from './project.entity';
import { UserEntity } from '../../auth/entities/user.entity';

export type ProjectMemberRole = 'owner' | 'maintainer' | 'viewer';

@Entity({ name: 'project_members' })
@Unique('uq_project_member', ['projectId', 'userId'])
export class ProjectMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ProjectEntity, (project) => project.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: ProjectEntity;

  @Column({ name: 'project_id', type: 'uuid' })
  @Index('idx_project_members_project_id')
  projectId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index('idx_project_members_user_id')
  userId!: string;

  @Column({ type: 'varchar', length: 16 })
  role!: ProjectMemberRole;

  @Column({ name: 'invited_at', type: 'timestamptz', nullable: true })
  invitedAt?: Date | null;

  @Column({ name: 'has_notifications', type: 'boolean', default: true })
  hasNotifications!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
