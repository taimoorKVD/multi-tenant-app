import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('field_types')
export class FieldType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120, unique: true })
  name!: string;

  @Column({ type: 'jsonb', name: 'config_schema', default: {} })
  configSchema!: Record<string, any>;

  @Column({ type: 'varchar', name: 'renderer_type', length: 120 })
  rendererType!: string;

  @Column({ type: 'varchar', name: 'component_name', length: 160 })
  componentName!: string;

  @Column({ type: 'varchar', nullable: true, length: 120 })
  icon!: string | null;

  @Column({ type: 'varchar', nullable: true, length: 120 })
  category!: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', name: 'supports_options', default: false })
  supportsOptions!: boolean;

  @Column({ type: 'boolean', name: 'supports_validation', default: true })
  supportsValidation!: boolean;

  @Column({ type: 'boolean', name: 'supports_conditions', default: true })
  supportsConditions!: boolean;

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
