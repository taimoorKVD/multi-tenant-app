import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../role/entities';
import { Exclude } from 'class-transformer';
import * as argon2 from 'argon2';
import { JobPosition } from '../../job-positions/entities';
import { Location } from '../../locations/entities';

@Entity('users')
export class User {
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$argon2')) {
      this.password = await argon2.hash(this.password);
    }
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  // @Column() //Same email should be allowed in different tenants
  email: string | null;

  // @Column({ type: 'varchar', name: 'phone_number', nullable: true, length: 30 })
  // phoneNumber: string | null;

  // @Column({ type: 'varchar', nullable: true, length: 255 })
  // address: string | null;

  // @Column({ type: 'varchar', nullable: true, length: 100 })
  // username: string | null;

  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  @Column({ type: 'varchar', name: 'plain_password', nullable: true })
  plainPassword: string | null;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  // @ManyToOne(() => JobPosition, { nullable: true, onDelete: 'SET NULL' })
  // @JoinColumn({ name: 'job_position_id' })
  // jobPosition: JobPosition | null;

  // @ManyToOne(() => Location, { nullable: true, onDelete: 'SET NULL' })
  // @JoinColumn({ name: 'location_id' })
  // location: Location | null;

  // @Column('simple-array', { name: 'availability_days', nullable: true })
  // availabilityDays: string[] | null;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
