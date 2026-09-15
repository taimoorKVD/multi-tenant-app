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
import { AssignmentStatus, AssignmentType } from './enums';
import { DataCollectionTemplate } from './data-collection-template.entity';
import { TemplateVersion } from './template-version.entity';

@Entity('dc_assignments')
@Index('idx_dc_assignments_assignee_due', ['assigneeUserId', 'dueAt'])
@Index('idx_dc_assignments_template_status', ['templateId', 'status'])
@Index('idx_dc_assignments_shared_group', ['sharedGroupKey'])
@Index('uq_dc_assignments_occurrence', ['occurrenceKey'], { unique: true })
export class DataCollectionAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

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

  @Column({ type: 'int', name: 'assignee_user_id', nullable: true })
  assigneeUserId!: number | null;

  @Column({ type: 'int', name: 'job_position_id', nullable: true })
  jobPositionId!: number | null;

  @Column({ type: 'int', name: 'location_id', nullable: true })
  locationId!: number | null;

  @Column({ type: 'timestamptz', name: 'due_at' })
  dueAt!: Date;

  @Column({ type: 'enum', enum: AssignmentStatus, default: AssignmentStatus.PENDING })
  status!: AssignmentStatus;

  @Column({
    type: 'enum',
    enum: AssignmentType,
    name: 'assignment_type',
    default: AssignmentType.INDIVIDUAL,
  })
  assignmentType!: AssignmentType;

  /**
   * Links all assignee rows for the same shared occurrence.
   * Null for individual assignments.
   */
  @Column({ type: 'varchar', length: 200, name: 'shared_group_key', nullable: true })
  sharedGroupKey!: string | null;

  /** User who finalized the shared (or individual) submission. */
  @Column({ type: 'int', name: 'completed_by_user_id', nullable: true })
  completedByUserId!: number | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;

  /** Unique key: templateId:versionId:dueAtISO:userId|jp:jobPositionId */
  @Column({ type: 'varchar', length: 200, name: 'occurrence_key' })
  occurrenceKey!: string;

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
