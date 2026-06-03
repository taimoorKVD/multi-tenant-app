import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Form } from './form.entity';
import { FormField } from './form-field.entity';

@Entity('form_sections')
export class FormSection {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'form_id' })
  formId!: number;

  @ManyToOne(() => Form, (form) => form.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  form!: Form;

  @Column({ type: 'varchar', length: 180 })
  title!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @OneToMany(() => FormField, (field) => field.section)
  fields!: FormField[];

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
