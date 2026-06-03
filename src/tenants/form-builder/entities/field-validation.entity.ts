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

@Entity('field_validations')
export class FieldValidation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'field_id' })
  fieldId!: number;

  @ManyToOne(() => FormField, (field) => field.validations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'field_id' })
  field!: FormField;

  @Column({ type: 'varchar', name: 'rule_type', length: 80 })
  ruleType!: string;

  @Column({ type: 'varchar', name: 'rule_value', length: 255 })
  ruleValue!: string;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
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
