import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities';
import { FlagSeverity } from './enums';
import { DataCollectionSubmission } from './data-collection-submission.entity';

@Entity('dc_submission_flags')
@Index('idx_dc_submission_flags_submission', ['submissionId'])
@Index('idx_dc_submission_flags_submission_resolved', ['submissionId', 'isResolved'])
@Index('idx_dc_submission_flags_created_by', ['createdById'])
export class DataCollectionSubmissionFlag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'submission_id' })
  submissionId!: number;

  @ManyToOne(() => DataCollectionSubmission, (submission) => submission.flags, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'submission_id' })
  submission!: DataCollectionSubmission;

  /** Field id from the pinned template version; null = response-level flag. */
  @Column({ type: 'varchar', name: 'field_id', length: 255, nullable: true })
  fieldId!: string | null;

  @Column({ type: 'text' })
  reason!: string;

  @Column({
    type: 'enum',
    enum: FlagSeverity,
    default: FlagSeverity.MEDIUM,
  })
  severity!: FlagSeverity;

  @Column({ type: 'int', name: 'created_by' })
  createdById!: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'int', name: 'resolved_by', nullable: true })
  resolvedById!: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolved_by' })
  resolvedBy!: User | null;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'text', name: 'resolution_note', nullable: true })
  resolutionNote!: string | null;

  @Column({ type: 'boolean', name: 'is_resolved', default: false })
  isResolved!: boolean;
}
