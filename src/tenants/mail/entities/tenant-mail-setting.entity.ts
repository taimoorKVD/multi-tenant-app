import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenant_mail_settings')
export class TenantMailSetting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', name: 'tenant_id', length: 100, nullable: true })
  tenantId!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider!: string | null;

  @Column({ type: 'varchar', length: 255 })
  host!: string;

  @Column({ type: 'int', default: 587 })
  port!: number;

  @Column({ type: 'boolean', default: false })
  secure!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username!: string | null;

  @Column({ name: 'encrypted_password', type: 'text', nullable: true })
  encryptedPassword!: string | null;

  @Column({ type: 'varchar', name: 'from_email', length: 255 })
  fromEmail!: string;

  @Column({ type: 'varchar', name: 'from_name', length: 255, nullable: true })
  fromName!: string | null;

  @Column({ type: 'varchar', name: 'reply_to', length: 255, nullable: true })
  replyTo!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'use_global_fallback', type: 'boolean', default: true })
  useGlobalFallback!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}