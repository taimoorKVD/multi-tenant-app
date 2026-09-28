import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Country } from '../../countries/entities';
import { State } from '../../states/entities';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  dbName: string;

  @Column({ unique: true })
  subdomain: string;

  @Column({ type: 'varchar', unique: false, nullable: true })
  customDomain?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', name: 'phone_country_code', length: 8, nullable: true })
  phoneCountryCode?: string | null;

  @Column({ type: 'varchar', name: 'phone_number', length: 30, nullable: true })
  phoneNumber?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  industry?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null;

  @Column({ name: 'country_id', type: 'int', nullable: true })
  countryId?: number | null;

  @Column({ name: 'state_id', type: 'int', nullable: true })
  stateId?: number | null;

  @ManyToOne(() => Country, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'country_id' })
  country?: Country | null;

  @ManyToOne(() => State, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'state_id' })
  state?: State | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  address?: string | null;

  @Column({ type: 'varchar', name: 'postal_code', length: 20, nullable: true })
  postalCode?: string | null;

  /** IANA timezone for frequency wall-clock (e.g. Asia/Karachi). Null → UTC. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  timezone?: string | null;

  @Column({ type: 'varchar', name: 'stripe_customer_id', length: 255, nullable: true })
  stripeCustomerId?: string | null;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
