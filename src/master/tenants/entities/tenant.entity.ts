import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

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

  @CreateDateColumn()
  createdAt: Date;
}
