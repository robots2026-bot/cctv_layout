import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ProjectEntity } from '../../projects/entities/project.entity';

export type DeviceStatus = 'online' | 'offline' | 'unknown';

@Entity({ name: 'devices' })
export class DeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ProjectEntity, (project) => project.devices, { onDelete: 'CASCADE' })
  project!: ProjectEntity;

  @Column({ name: 'project_id' })
  projectId!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 60 })
  type!: string;

  @Column({ name: 'ip_address', nullable: true, length: 45 })
  ipAddress?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 16, default: 'unknown' })
  status!: DeviceStatus;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
