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
import { DcManagerOrder } from './dc-manager-order.entity';
import { DcManagerRequest } from './dc-manager-request.entity';

@Entity('dc_manager_order_items')
@Index('idx_dc_manager_order_items_order', ['orderId'])
export class DcManagerOrderItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'order_id' })
  orderId!: number;

  @ManyToOne(() => DcManagerOrder, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: DcManagerOrder;

  @Column({ type: 'int', name: 'request_id', nullable: true })
  requestId!: number | null;

  @ManyToOne(() => DcManagerRequest, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'request_id' })
  request!: DcManagerRequest | null;

  @Column({ type: 'int', name: 'item_id', nullable: true })
  itemId!: number | null;

  @Column({ type: 'varchar', length: 200, name: 'item_label', nullable: true })
  itemLabel!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  qty!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'quoted_price', nullable: true })
  quotedPrice!: string | null;

  @Column({ type: 'boolean', default: false })
  received!: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'actual_price', nullable: true })
  actualPrice!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  size!: string | null;

  @Column({ type: 'varchar', length: 80, name: 'item_number', nullable: true })
  itemNumber!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
