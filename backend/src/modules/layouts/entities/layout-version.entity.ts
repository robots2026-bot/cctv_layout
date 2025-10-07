import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { LayoutEntity } from './layout.entity';
import { UserEntity } from '../../auth/entities/user.entity';

@Entity({ name: 'layout_versions' })
export class LayoutVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => LayoutEntity, (layout) => layout.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'layout_id' })
  layout!: LayoutEntity;

  @Column({ name: 'layout_id' })
  layoutId!: string;

  @Column({ name: 'version_no', type: 'int' })
  versionNo!: number;

  @Column({ name: 'elements_json', type: 'jsonb' })
  elementsJson!: unknown;

  @Column({ name: 'connections_json', type: 'jsonb' })
  connectionsJson!: unknown;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: UserEntity | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
