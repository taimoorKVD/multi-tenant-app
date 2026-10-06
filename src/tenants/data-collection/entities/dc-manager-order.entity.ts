import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ManagerOrderStatus, ManagerRequestKind } from './enums';
import { DcManagerOrderItem } from './dc-manager-order-item.entity';
import { DcManagerOrderMessage } from './dc-manager-order-message.entity';

@Entity('dc_manager_orders')
@Index('idx_dc_manager_orders_kind_status', ['kind', 'status'])
@Index('idx_dc_manager_orders_vendor', ['vendorId'])
export class DcManagerOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 24 })
  kind!: ManagerRequestKind;

  @Column({ type: 'varchar', length: 40, name: 'order_no' })
  orderNo!: string;

  @Column({ type: 'int', name: 'vendor_id' })
  vendorId!: number;

  @Column({ type: 'varchar', length: 24, default: ManagerOrderStatus.PENDING })
  status!: ManagerOrderStatus;

  @Column({ type: 'int', name: 'created_by_user_id', nullable: true })
  createdByUserId!: number | null;

  @Column({ type: 'boolean', name: 'contacted_website', default: false })
  contactedWebsite!: boolean;

  @Column({ type: 'boolean', name: 'contacted_phone', default: false })
  contactedPhone!: boolean;

  @Column({ type: 'boolean', name: 'contacted_email', default: false })
  contactedEmail!: boolean;

  @Column({ type: 'jsonb', name: 'vendor_snapshot', default: {} })
  vendorSnapshot!: Record<string, any>;

  @Column({ type: 'timestamptz', name: 'emailed_at', nullable: true })
  emailedAt!: Date | null;

  @Column({ type: 'varchar', length: 255, name: 'email_to', nullable: true })
  emailTo!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'email_status', nullable: true })
  emailStatus!: string | null;

  @OneToMany(() => DcManagerOrderItem, (item) => item.order)
  items!: DcManagerOrderItem[];

  @OneToMany(() => DcManagerOrderMessage, (message) => message.order)
  messages!: DcManagerOrderMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
