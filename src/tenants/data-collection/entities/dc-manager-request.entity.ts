import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ManagerRequestKind, ManagerRequestStatus } from './enums';
import { DataCollectionSubmission } from './data-collection-submission.entity';
import { DataCollectionAssignment } from './data-collection-assignment.entity';
import { DataCollectionTemplate } from './data-collection-template.entity';
import { TemplateVersion } from './template-version.entity';

@Entity('dc_manager_requests')
@Index('idx_dc_manager_requests_kind_status', ['kind', 'status'])
@Index('idx_dc_manager_requests_submission', ['submissionId'])
@Index('uq_dc_manager_requests_fire', ['submissionId', 'ruleClientId', 'actionClientId'], {
  unique: true,
})
export class DcManagerRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 24 })
  kind!: ManagerRequestKind;

  @Column({ type: 'varchar', length: 24, default: ManagerRequestStatus.OPEN })
  status!: ManagerRequestStatus;

  @Column({ type: 'varchar', length: 40, name: 'request_no', nullable: true })
  requestNo!: string | null;

  @Column({ type: 'int', name: 'submission_id' })
  submissionId!: number;

  @ManyToOne(() => DataCollectionSubmission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission!: DataCollectionSubmission;

  @Column({ type: 'int', name: 'assignment_id' })
  assignmentId!: number;

  @ManyToOne(() => DataCollectionAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment!: DataCollectionAssignment;

  @Column({ type: 'int', name: 'template_id' })
  templateId!: number;

  @ManyToOne(() => DataCollectionTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template!: DataCollectionTemplate;

  @Column({ type: 'int', name: 'template_version_id' })
  templateVersionId!: number;

  @ManyToOne(() => TemplateVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_version_id' })
  templateVersion!: TemplateVersion;

  @Column({ type: 'varchar', length: 120, name: 'rule_client_id' })
  ruleClientId!: string;

  @Column({ type: 'varchar', length: 120, name: 'action_client_id' })
  actionClientId!: string;

  @Column({ type: 'int', name: 'requested_by_user_id', nullable: true })
  requestedByUserId!: number | null;

  @Column({ type: 'int', name: 'item_id', nullable: true })
  itemId!: number | null;

  @Column({ type: 'int', name: 'vendor_id', nullable: true })
  vendorId!: number | null;

  @Column({ type: 'varchar', length: 200, name: 'requester_name', nullable: true })
  requesterName!: string | null;

  @Column({ type: 'varchar', length: 200, name: 'item_label', nullable: true })
  itemLabel!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  quantity!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'quoted_price', nullable: true })
  quotedPrice!: string | null;

  @Column({ type: 'jsonb', name: 'answers_snapshot', default: {} })
  answersSnapshot!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
