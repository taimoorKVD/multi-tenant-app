import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DataCollectionTemplate } from './data-collection-template.entity';

@Entity('dc_template_versions')
@Index('idx_dc_template_versions_template_version', ['templateId', 'versionNumber'], { unique: true })
export class TemplateVersion {
  
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'template_id' })
  templateId!: number;

  @ManyToOne(() => DataCollectionTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template!: DataCollectionTemplate;

  @Column({ type: 'int', name: 'version_number' })
  versionNumber!: number;

  @Column({ type: 'jsonb', name: 'schema_snapshot' })
  schemaSnapshot!: Record<string, any>;

  @Column({ type: 'boolean', name: 'is_active', default: false })
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
