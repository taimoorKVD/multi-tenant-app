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
import { InvoiceStatus } from './enums';
import { Subscription } from './subscription.entity';
import { Tenant } from '../../tenants/entities';

@Entity('invoices')
@Index(['tenantId'])
@Index(['status'])
@Index(['invoiceNumber'], { unique: true })
@Index(['stripeInvoiceId'], { unique: true, where: '"stripe_invoice_id" IS NOT NULL' })
export class Invoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', name: 'invoice_number', length: 40 })
  invoiceNumber!: string;

  @Column({ type: 'int', name: 'tenant_id' })
  tenantId!: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ type: 'int', name: 'subscription_id', nullable: true })
  subscriptionId!: number | null;

  @ManyToOne(() => Subscription, (subscription) => subscription.invoices, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'subscription_id' })
  subscription!: Subscription | null;

  @Column({ type: 'int', name: 'amount_cents' })
  amountCents!: number;

  @Column({ type: 'varchar', length: 3, default: 'EUR' })
  currency!: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING })
  status!: InvoiceStatus;

  @Column({ type: 'date', name: 'invoice_date' })
  invoiceDate!: string;

  @Column({ type: 'date', name: 'due_date', nullable: true })
  dueDate!: string | null;

  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'varchar', name: 'hosted_invoice_url', length: 500, nullable: true })
  hostedInvoiceUrl!: string | null;

  @Column({ type: 'varchar', name: 'invoice_pdf_url', length: 500, nullable: true })
  invoicePdfUrl!: string | null;

  @Column({ type: 'varchar', name: 'stripe_invoice_id', length: 255, nullable: true })
  stripeInvoiceId!: string | null;

  @Column({ type: 'varchar', name: 'stripe_payment_intent_id', length: 255, nullable: true })
  stripePaymentIntentId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
