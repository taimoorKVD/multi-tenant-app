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
import {
  EMAIL_RECIPIENT_CHANNEL,
  EMAIL_RECIPIENT_SOURCE,
  EmailRecipientChannel,
  EmailRecipientSource,
} from '../../../mail/constants/mail.constants';
import { EmailTemplate } from './email-template.entity';

@Entity('email_template_recipients')
@Index(['templateId', 'channel'])
export class EmailTemplateRecipient {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'template_id' })
  templateId!: number;

  @ManyToOne(() => EmailTemplate, (template) => template.recipients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template!: EmailTemplate;

  @Column({ type: 'varchar', length: 10, default: EMAIL_RECIPIENT_CHANNEL.TO })
  channel!: EmailRecipientChannel;

  @Column({
    type: 'varchar',
    name: 'source_type',
    length: 20,
    default: EMAIL_RECIPIENT_SOURCE.STATIC,
  })
  sourceType!: EmailRecipientSource;

  @Column({ type: 'text' })
  value!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}