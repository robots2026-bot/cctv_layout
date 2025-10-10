import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { LayoutEntity } from '../../layouts/entities/layout.entity';
import { DeviceEntity } from '../../devices/entities/device.entity';
import { ActivityLogEntity } from '../../activity-log/entities/activity-log.entity';

@Entity({ name: 'projects' })
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ nullable: true, length: 255, type: 'varchar' })
  location?: string | null;

  @Column({ name: 'default_layout_id', type: 'uuid', nullable: true })
  defaultLayoutId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => LayoutEntity, (layout) => layout.project)
  layouts!: LayoutEntity[];

  @OneToMany(() => DeviceEntity, (device) => device.project)
  devices!: DeviceEntity[];

  @OneToMany(() => ActivityLogEntity, (log) => log.project)
  logs!: ActivityLogEntity[];
}
