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
import { Form } from './form.entity';
import { FormField } from './form-field.entity';
import { ConditionalActionType, ConditionalOperator } from './enums';

@Entity('field_conditional_rules')
export class FieldConditionalRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'form_id' })
  formId!: number;

  @ManyToOne(() => Form, (form) => form.conditionalRules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  form!: Form;

  @Column({ type: 'int', name: 'dependent_field_id' })
  dependentFieldId!: number;

  @ManyToOne(() => FormField, (field) => field.dependentRules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dependent_field_id' })
  dependentField!: FormField;

  @Column({ type: 'int', name: 'source_field_id' })
  sourceFieldId!: number;

  @ManyToOne(() => FormField, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_field_id' })
  sourceField!: FormField;

  @Column({ type: 'enum', enum: ConditionalOperator })
  operator!: ConditionalOperator;

  @Column({ type: 'varchar', name: 'comparison_value', nullable: true, length: 255 })
  comparisonValue!: string | null;

  @Column({ type: 'enum', enum: ConditionalActionType, name: 'action_type' })
  actionType!: ConditionalActionType;

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
