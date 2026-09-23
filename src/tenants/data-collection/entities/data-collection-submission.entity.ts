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
import { User } from '../../users/entities';
import { SubmissionStatus } from './enums';
import { DataCollectionAssignment } from './data-collection-assignment.entity';
import { TemplateVersion } from './template-version.entity';
import { DataCollectionSubmissionFlag } from './data-collection-submission-flag.entity';

@Entity('dc_submissions')
@Index('idx_dc_submissions_assignment', ['assignmentId'])
@Index('idx_dc_submissions_status', ['status'])
export class DataCollectionSubmission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'assignment_id' })
  assignmentId!: number;

  @ManyToOne(() => DataCollectionAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment!: DataCollectionAssignment;

  @Column({ type: 'int', name: 'template_version_id' })
  templateVersionId!: number;

  @ManyToOne(() => TemplateVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_version_id' })
  templateVersion!: TemplateVersion;

  @Column({ type: 'int', name: 'submitted_by', nullable: true })
  submittedBy!: number | null;

  @Column({ type: 'jsonb', name: 'answers', default: {} })
  answers!: Record<string, any>;

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.DRAFT })
  status!: SubmissionStatus;

  @Column({ type: 'timestamptz', name: 'submitted_at', nullable: true })
  submittedAt!: Date | null;

  @Column({ type: 'int', name: 'reviewed_by', nullable: true })
  reviewedById!: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy!: User | null;

  @Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'text', name: 'review_note', nullable: true })
  reviewNote!: string | null;

  @OneToMany(() => DataCollectionSubmissionFlag, (flag) => flag.submission)
  flags!: DataCollectionSubmissionFlag[];

  @Column({ type: 'int', name: 'created_by', nullable: true })
  createdBy!: number | null;

  @Column({ type: 'int', name: 'updated_by', nullable: true })
  updatedBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
