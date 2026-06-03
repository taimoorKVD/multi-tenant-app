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
import { Form } from './form.entity';

@Entity('form_versions')
@Index('idx_form_versions_form_version', ['formId', 'versionNumber'], { unique: true })
export class FormVersion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'form_id' })
  formId!: number;

  @ManyToOne(() => Form, (form) => form.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  form!: Form;

  @Column({ type: 'int', name: 'version_number' })
  versionNumber!: number;

  @Column({ type: 'jsonb', name: 'schema_snapshot' })
  schemaSnapshot!: Record<string, any>;

  @Column({ type: 'boolean', name: 'is_active', default: false })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'int', name: 'created_by', nullable: true })
  createdBy!: number | null;

  @Column({ type: 'int', name: 'updated_by', nullable: true })
  updatedBy!: number | null;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
