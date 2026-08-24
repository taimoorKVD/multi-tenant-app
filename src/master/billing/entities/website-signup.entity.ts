import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WebsiteSignupStatus } from './enums';

@Entity('website_signups')
@Index(['stripeCheckoutSessionId'], { unique: true, where: '"stripe_checkout_session_id" IS NOT NULL' })
export class WebsiteSignup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int', name: 'plan_id' })
  planId!: number;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'text', name: 'admin_password_encrypted' })
  adminPasswordEncrypted!: string;

  @Column({ type: 'varchar', name: 'one_time_login_token_hash', length: 128, nullable: true })
  oneTimeLoginTokenHash!: string | null;

  @Column({ type: 'timestamptz', name: 'one_time_login_token_expires_at', nullable: true })
  oneTimeLoginTokenExpiresAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'one_time_login_token_used_at', nullable: true })
  oneTimeLoginTokenUsedAt!: Date | null;

  @Column({ type: 'varchar', name: 'stripe_checkout_session_id', length: 255, nullable: true })
  stripeCheckoutSessionId!: string | null;

  @Column({ type: 'varchar', name: 'stripe_customer_id', length: 255, nullable: true })
  stripeCustomerId!: string | null;

  @Column({ type: 'varchar', name: 'stripe_subscription_id', length: 255, nullable: true })
  stripeSubscriptionId!: string | null;

  @Column({ type: 'int', name: 'tenant_id', nullable: true })
  tenantId!: number | null;

  @Column({ type: 'enum', enum: WebsiteSignupStatus, default: WebsiteSignupStatus.PENDING })
  status!: WebsiteSignupStatus;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
