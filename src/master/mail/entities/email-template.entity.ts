import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EMAIL_TEMPLATE_STATUS, EmailTemplateStatus } from '../../../mail/constants/mail.constants';
import { EmailTemplateRecipient } from './email-template-recipient.entity';

@Entity('email_templates')
@Index(['module', 'action', 'role', 'version'])
export class EmailTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 80 })
  module!: string;

  @Column({ type: 'varchar', length: 80 })
  action!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  role!: string | null;

  @Column({ name: 'to', type: 'text', nullable: true })
  to!: string | null;

  @Column({ name: 'cc', type: 'text', nullable: true })
  cc!: string | null;

  @Column({ name: 'bcc', type: 'text', nullable: true })
  bcc!: string | null;

  @Column({ length: 255 })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'varchar', length: 20, default: EMAIL_TEMPLATE_STATUS.ACTIVE })
  status!: EmailTemplateStatus;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'int', nullable: true })
  priority!: number | null;

  @Column({ type: 'varchar', name: 'tenant_id', length: 100, nullable: true })
  tenantId!: string | null;

  @Column({ name: 'is_override', type: 'boolean', default: false })
  isOverride!: boolean;

  @OneToMany(() => EmailTemplateRecipient, (recipient) => recipient.template, {
    cascade: true,
  })
  recipients!: EmailTemplateRecipient[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}