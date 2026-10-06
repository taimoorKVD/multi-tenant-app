import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ManagerOrderChannel } from './enums';
import { DcManagerOrder } from './dc-manager-order.entity';

@Entity('dc_manager_order_messages')
@Index('idx_dc_manager_order_messages_order', ['orderId'])
export class DcManagerOrderMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'order_id' })
  orderId!: number;

  @ManyToOne(() => DcManagerOrder, (order) => order.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: DcManagerOrder;

  @Column({ type: 'varchar', length: 24 })
  channel!: ManagerOrderChannel;

  @Column({ type: 'varchar', length: 255, name: 'to_email', nullable: true })
  toEmail!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject!: string | null;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'logged' })
  status!: string;

  @Column({ type: 'varchar', length: 120, name: 'provider_message_id', nullable: true })
  providerMessageId!: string | null;

  @Column({ type: 'int', name: 'created_by', nullable: true })
  createdBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
