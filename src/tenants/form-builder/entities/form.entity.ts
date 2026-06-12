import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DynamicModule } from './module.entity';
import { FormStatus } from './enums';
import { FormVersion } from './form-version.entity';

@Entity('forms')
@Index('idx_forms_module_status', ['moduleId', 'status'])
export class Form {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'module_id' })
  moduleId!: number;

  @ManyToOne(() => DynamicModule, (module) => module.forms, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'module_id' })
  module!: DynamicModule;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ type: 'enum', enum: FormStatus, default: FormStatus.DRAFT })
  status!: FormStatus;

  @Column({ type: 'jsonb', name: 'autosave_schema', nullable: true })
  autosaveSchema!: Record<string, any> | null;

  @OneToMany(() => FormVersion, (version) => version.form)
  versions!: FormVersion[];

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
