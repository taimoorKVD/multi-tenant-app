import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ManagerCartStatus, ManagerRequestKind } from './enums';
import { DcManagerCartItem } from './dc-manager-cart-item.entity';

@Entity('dc_manager_carts')
@Index('idx_dc_manager_carts_user_kind_status', ['userId', 'kind', 'status'])
export class DcManagerCart {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'user_id' })
  userId!: number;

  @Column({ type: 'varchar', length: 24 })
  kind!: ManagerRequestKind;

  @Column({ type: 'varchar', length: 24, default: ManagerCartStatus.OPEN })
  status!: ManagerCartStatus;

  @OneToMany(() => DcManagerCartItem, (item) => item.cart)
  items!: DcManagerCartItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
