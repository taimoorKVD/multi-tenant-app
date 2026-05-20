import {Exclude} from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {VendorContact} from './vendor-contact.entity';
import {VendorOrderDeadline} from './vendor-order-deadline.entity';

export enum VendorPaymentMethod {
  COD = 'cod',
  EFT = 'eft',
}

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({type: 'varchar', length: 150, unique: true})
  name!: string;

  @Column({type: 'varchar', length: 255, nullable: true})
  address!: string | null;

  @Column({name: 'country_id', type: 'int', nullable: true})
  countryId!: number | null;

  @Column({name: 'state_id', type: 'int', nullable: true})
  stateId!: number | null;

  @Column({name: 'city_id', type: 'int', nullable: true})
  cityId!: number | null;

  @Column({type: 'varchar', length: 30, nullable: true})
  phoneNumber!: string | null;

  @Column({type: 'varchar', length: 255, nullable: true})
  email!: string | null;

  @Column({type: 'varchar', length: 255, nullable: true})
  website!: string | null;

  @Column({type: 'varchar', length: 100, nullable: true})
  username!: string | null;

  @Exclude()
  @Column({type: 'varchar', length: 255, nullable: true})
  password!: string | null;

  @Column({type: 'decimal', precision: 10, scale: 2, nullable: true})
  minOrder!: number | null;

  @Column({
    type: 'varchar',
    name: 'payment_methods',
    array: true,
    nullable: true,
  })
  paymentMethods!: VendorPaymentMethod[] | null;

  @Column({type: 'varchar', nullable: true})
  instructions!: string | null;

  @OneToMany(() => VendorContact, (contact) => contact.vendor, {
    cascade: true,
    eager: false,
    orphanedRowAction: 'delete',
  })
  contacts!: VendorContact[];

  @OneToMany(() => VendorOrderDeadline, (deadline) => deadline.vendor, {
    cascade: true,
    eager: false,
    orphanedRowAction: 'delete',
  })
  orderDeadlines!: VendorOrderDeadline[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
