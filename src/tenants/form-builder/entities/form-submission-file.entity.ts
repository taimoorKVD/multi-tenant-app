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
import { FormSubmission } from './form-submission.entity';
import { FormField } from './form-field.entity';

@Entity('form_submission_files')
export class FormSubmissionFile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'submission_id' })
  submissionId!: number;

  @ManyToOne(() => FormSubmission, (submission) => submission.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission!: FormSubmission;

  @Column({ type: 'int', name: 'field_id', nullable: true })
  fieldId!: number | null;

  @ManyToOne(() => FormField, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'field_id' })
  field!: FormField | null;

  @Column({ type: 'varchar', name: 'file_name', length: 255 })
  fileName!: string;

  @Column({ type: 'varchar', name: 'file_path', length: 500 })
  filePath!: string;

  @Column({ type: 'varchar', name: 'file_type', length: 120 })
  fileType!: string;

  @Column({ type: 'bigint', name: 'file_size' })
  fileSize!: string;

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
