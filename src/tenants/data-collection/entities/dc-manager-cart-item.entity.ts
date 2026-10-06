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
import { DcManagerCart } from './dc-manager-cart.entity';
import { DcManagerRequest } from './dc-manager-request.entity';

@Entity('dc_manager_cart_items')
@Index('idx_dc_manager_cart_items_cart', ['cartId'])
export class DcManagerCartItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'cart_id' })
  cartId!: number;

  @ManyToOne(() => DcManagerCart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart!: DcManagerCart;

  @Column({ type: 'int', name: 'request_id', nullable: true })
  requestId!: number | null;

  @ManyToOne(() => DcManagerRequest, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'request_id' })
  request!: DcManagerRequest | null;

  @Column({ type: 'int', name: 'item_id', nullable: true })
  itemId!: number | null;

  @Column({ type: 'int', name: 'vendor_id', nullable: true })
  vendorId!: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 1 })
  quantity!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'unit_cost', nullable: true })
  unitCost!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  size!: string | null;

  @Column({ type: 'varchar', length: 80, name: 'item_number', nullable: true })
  itemNumber!: string | null;

  @Column({ type: 'varchar', length: 200, name: 'item_label', nullable: true })
  itemLabel!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
