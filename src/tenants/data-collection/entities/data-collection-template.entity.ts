import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TemplateStatus } from './enums';

@Entity('dc_templates')
@Index('idx_dc_templates_status_active', ['status', 'isActive'])
export class DataCollectionTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'jsonb', name: 'schema', nullable: true })
  schema!: Record<string, any> | null;

  @Column({ type: 'enum', enum: TemplateStatus, default: TemplateStatus.DRAFT })
  status!: TemplateStatus;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'int', name: 'created_by', nullable: true })
  createdBy!: number | null;

  @Column({ type: 'int', name: 'updated_by', nullable: true })
  updatedBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
