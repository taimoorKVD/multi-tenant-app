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
import { FormVersion } from './form-version.entity';
import { SubmissionIndex } from './submission-index.entity';
import { FormSubmissionFile } from './form-submission-file.entity';

@Entity('form_submissions')
export class FormSubmission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'form_id' })
  formId!: number;

  @ManyToOne(() => Form, (form) => form.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  form!: Form;

  @Column({ type: 'int', name: 'version_id' })
  versionId!: number;

  @ManyToOne(() => FormVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'version_id' })
  version!: FormVersion;

  @Column({ type: 'jsonb', name: 'submission_data' })
  submissionData!: Record<string, any>;

  @OneToMany(() => SubmissionIndex, (entry) => entry.submission)
  indices!: SubmissionIndex[];

  @OneToMany(() => FormSubmissionFile, (file) => file.submission)
  files!: FormSubmissionFile[];

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
