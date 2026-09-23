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
import { SubmissionReviewAction } from './enums';
import { DataCollectionSubmission } from './data-collection-submission.entity';

@Entity('dc_submission_review_events')
@Index('idx_dc_submission_review_events_submission', ['submissionId'])
@Index('idx_dc_submission_review_events_action', ['action'])
export class DataCollectionSubmissionReviewEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'submission_id' })
  submissionId!: number;

  @ManyToOne(() => DataCollectionSubmission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission!: DataCollectionSubmission;

  @Column({ type: 'enum', enum: SubmissionReviewAction })
  action!: SubmissionReviewAction;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'int', name: 'performed_by' })
  performedById!: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'performed_by' })
  performedBy!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
