import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BillingCycle, PlanStatus } from './enums';
import { Subscription } from './subscription.entity';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'int', name: 'price_cents' })
  priceCents!: number;

  @Column({ type: 'varchar', length: 3, default: 'EUR' })
  currency!: string;

  @Column({ type: 'enum', enum: BillingCycle, name: 'billing_cycle', default: BillingCycle.MONTHLY })
  billingCycle!: BillingCycle;

  @Column({ type: 'int', name: 'users_limit', nullable: true })
  usersLimit!: number | null;

  @Column({ type: 'int', name: 'storage_gb', nullable: true })
  storageGb!: number | null;

  @Column({ type: 'varchar', name: 'support_level', length: 80, nullable: true })
  supportLevel!: string | null;

  @Column({ type: 'jsonb', default: [] })
  features!: string[];

  @Column({ type: 'jsonb', default: [] })
  modules!: string[];

  @Column({ type: 'int', name: 'trial_days', default: 0 })
  trialDays!: number;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ type: 'enum', enum: PlanStatus, default: PlanStatus.ACTIVE })
  status!: PlanStatus;

  @Column({ type: 'varchar', name: 'stripe_product_id', length: 255, nullable: true })
  stripeProductId!: string | null;

  @Column({ type: 'varchar', name: 'stripe_price_id', length: 255, nullable: true })
  stripePriceId!: string | null;

  @OneToMany(() => Subscription, (subscription) => subscription.plan)
  subscriptions!: Subscription[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
