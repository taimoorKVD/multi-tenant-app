import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkflowSkipReason } from './enums';
import { DataCollectionSubmission } from './data-collection-submission.entity';
import { DataCollectionAssignment } from './data-collection-assignment.entity';
import { DataCollectionTemplate } from './data-collection-template.entity';
import { TemplateVersion } from './template-version.entity';

@Entity('dc_workflow_executions')
@Index('idx_dc_workflow_executions_submission', ['submissionId'])
@Index('idx_dc_workflow_executions_template', ['templateId'])
export class DcWorkflowExecution {
  @PrimaryGeneratedColumn()
  id!: number;

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

  @Column({ type: 'varchar', length: 200, name: 'rule_name', nullable: true })
  ruleName!: string | null;

  @Column({ type: 'boolean', default: false })
  matched!: boolean;

  @Column({ type: 'varchar', length: 32, name: 'skip_reason', nullable: true })
  skipReason!: WorkflowSkipReason | null;

  @Column({ type: 'jsonb', name: 'condition_results', default: [] })
  conditionResults!: unknown[];

  @Column({ type: 'jsonb', name: 'actions_fired', default: [] })
  actionsFired!: unknown[];

  @CreateDateColumn({ name: 'executed_at' })
  executedAt!: Date;
}
