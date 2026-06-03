import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FormField } from './form-field.entity';

@Entity('field_options')
export class FieldOption {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'field_id' })
  fieldId!: number;

  @ManyToOne(() => FormField, (field) => field.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'field_id' })
  field!: FormField;

  @Column({ type: 'varchar', length: 180 })
  label!: string;

  @Column({ type: 'varchar', length: 180 })
  value!: string;

  @Column({ type: 'boolean', name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder!: number;

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
