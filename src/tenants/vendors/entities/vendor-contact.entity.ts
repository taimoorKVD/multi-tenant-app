import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {Vendor} from './vendor.entity';

@Entity('vendor_contacts')
export class VendorContact {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Vendor, (vendor) => vendor.contacts, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'vendor_id'})
  vendor!: Vendor;

  @Column({type: 'varchar', length: 150})
  name!: string;

  @Column({type: 'varchar', length: 30, nullable: true})
  phoneNumber!: string | null;

  @Column({type: 'varchar', length: 255, nullable: true})
  email!: string | null;

  @Column({name: 'is_primary', default: false})
  isPrimary!: boolean;
}
