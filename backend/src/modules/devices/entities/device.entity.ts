import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { ProjectEntity } from '../../projects/entities/project.entity';

export type DeviceStatus = 'online' | 'offline' | 'unknown';

@Entity({ name: 'devices' })
@Index('uq_devices_project_mac', ['projectId', 'macAddress'], {
  unique: true,
  where: '"mac_address" IS NOT NULL'
})
export class DeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ProjectEntity, (project) => project.devices, { onDelete: 'CASCADE' })
  project!: ProjectEntity;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ length: 120 })
  name!: string;

@Column({ length: 60 })
type!: string;

@Column({ name: 'alias', type: 'varchar', length: 120, nullable: true })
alias?: string | null;

@Column({ name: 'mac_address', type: 'varchar', length: 32, nullable: true })
macAddress?: string | null;

@Column({ name: 'ip_address', type: 'varchar', nullable: true, length: 45 })
ipAddress?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ name: 'hidden_at', type: 'timestamptz', nullable: true })
  hiddenAt?: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'unknown' })
  status!: DeviceStatus;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
