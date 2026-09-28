import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('timezones')
export class Timezone {
  @PrimaryGeneratedColumn()
  id!: number;

  /** IANA name, e.g. Asia/Karachi */
  @Column({ type: 'varchar', length: 64, unique: true })
  name!: string;

  /** Human-readable label, e.g. Asia / Karachi (UTC+05:00) */
  @Column({ type: 'varchar', length: 160 })
  label!: string;

  /** Continent/region prefix from IANA name (e.g. Asia, America) */
  @Column({ type: 'varchar', length: 64, nullable: true })
  region!: string | null;

  /** Current UTC offset in minutes (e.g. 300 for UTC+05:00) */
  @Column({ name: 'utc_offset_minutes', type: 'int', nullable: true })
  utcOffsetMinutes!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
