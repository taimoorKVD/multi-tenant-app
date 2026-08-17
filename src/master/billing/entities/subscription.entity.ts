import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BillingCycle, SubscriptionStatus } from './enums';
import { Plan } from './plan.entity';
import { Tenant } from '../../tenants/entities';
import { Invoice } from './invoice.entity';

@Entity('subscriptions')
@Index(['tenantId'])
@Index(['status'])
@Index(['stripeSubscriptionId'], { unique: true, where: '"stripe_subscription_id" IS NOT NULL' })
export class Subscription {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'tenant_id' })
  tenantId!: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ type: 'int', name: 'plan_id' })
  planId!: number;

  @ManyToOne(() => Plan, (plan) => plan.subscriptions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan!: Plan;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.INCOMPLETE })
  status!: SubscriptionStatus;

  @Column({ type: 'enum', enum: BillingCycle, name: 'billing_cycle', default: BillingCycle.MONTHLY })
  billingCycle!: BillingCycle;

  @Column({ type: 'int', name: 'amount_cents' })
  amountCents!: number;

  @Column({ type: 'varchar', length: 3, default: 'EUR' })
  currency!: string;

  @Column({ type: 'timestamptz', name: 'trial_ends_at', nullable: true })
  trialEndsAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'current_period_start', nullable: true })
  currentPeriodStart!: Date | null;

  @Column({ type: 'timestamptz', name: 'current_period_end', nullable: true })
  currentPeriodEnd!: Date | null;

  @Column({ type: 'timestamptz', name: 'cancel_at', nullable: true })
  cancelAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'cancelled_at', nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: 'boolean', name: 'cancel_at_period_end', default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ type: 'varchar', name: 'stripe_customer_id', length: 255, nullable: true })
  stripeCustomerId!: string | null;

  @Column({ type: 'varchar', name: 'stripe_subscription_id', length: 255, nullable: true })
  stripeSubscriptionId!: string | null;

  @OneToMany(() => Invoice, (invoice) => invoice.subscription)
  invoices!: Invoice[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
