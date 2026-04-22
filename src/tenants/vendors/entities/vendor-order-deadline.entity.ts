import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique} from 'typeorm';
import {Vendor} from './vendor.entity';

export enum VendorOrderDay {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

@Entity('vendor_order_deadlines')
@Unique('UQ_vendor_order_deadlines_vendor_day', ['vendor', 'day'])
export class VendorOrderDeadline {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Vendor, (vendor) => vendor.orderDeadlines, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'vendor_id'})
  vendor!: Vendor;

  @Column({type: 'varchar', length: 20})
  day!: VendorOrderDay;
}
