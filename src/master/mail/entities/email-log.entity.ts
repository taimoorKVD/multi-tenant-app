import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EMAIL_LOG_STATUS, EmailLogStatus } from '../../../mail/constants/mail.constants';

@Entity('email_logs')
@Index(['tenantId', 'module', 'action'])
@Index(['idempotencyKey'], { unique: true })
export class EmailLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', name: 'tenant_id', length: 100, nullable: true })
  tenantId!: string | null;

  @Column({ type: 'varchar', length: 80 })
  module!: string;

  @Column({ type: 'varchar', length: 80 })
  action!: string;

  @Column({ name: 'template_id' })
  templateId!: number;

  @Column({ name: 'template_version', type: 'int', default: 1 })
  templateVersion!: number;

  @Column({ type: 'varchar', name: 'template_name', length: 150 })
  templateName!: string;

  @Column({ type: 'varchar', name: 'idempotency_key', length: 255 })
  idempotencyKey!: string;

  @Column({ type: 'text' })
  to!: string;

  @Column({ type: 'text', nullable: true })
  cc!: string | null;

  @Column({ type: 'text', nullable: true })
  bcc!: string | null;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'varchar', length: 20, default: EMAIL_LOG_STATUS.PENDING })
  status!: EmailLogStatus;

  @Column({ type: 'varchar', name: 'provider', length: 50, nullable: true })
  provider!: string | null;

  @Column({ type: 'varchar', name: 'smtp_host', length: 255, nullable: true })
  smtpHost!: string | null;

  @Column({ type: 'varchar', name: 'from_email', length: 255, nullable: true })
  fromEmail!: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'transport_message_id', type: 'text', nullable: true })
  transportMessageId!: string | null;

  @Column({ name: 'last_attempt_at', type: 'timestamp', nullable: true })
  lastAttemptAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}