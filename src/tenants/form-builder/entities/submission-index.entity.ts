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
import { FormSubmission } from './form-submission.entity';

@Entity('submission_index')
@Index('idx_submission_index_field_type', ['fieldKey', 'valueType'])
export class SubmissionIndex {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'submission_id' })
  submissionId!: number;

  @ManyToOne(() => FormSubmission, (submission) => submission.indices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission!: FormSubmission;

  @Column({ type: 'varchar', name: 'field_key', length: 120 })
  fieldKey!: string;

  @Column({ type: 'jsonb' })
  value!: any;

  @Column({ type: 'varchar', name: 'value_type', length: 40 })
  valueType!: string;

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
