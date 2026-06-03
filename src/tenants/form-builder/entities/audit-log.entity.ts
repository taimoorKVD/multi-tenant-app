import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
export class FormAuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', name: 'entity_type', length: 120 })
  entityType!: string;

  @Column({ type: 'int', name: 'entity_id' })
  entityId!: number;

  @Column({ type: 'varchar', length: 80 })
  action!: string;

  @Column({ type: 'jsonb', name: 'old_value', nullable: true })
  oldValue!: Record<string, any> | null;

  @Column({ type: 'jsonb', name: 'new_value', nullable: true })
  newValue!: Record<string, any> | null;

  @Column({ type: 'varchar', name: 'ip_address', nullable: true, length: 80 })
  ipAddress!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'int', name: 'created_by', nullable: true })
  createdBy!: number | null;

  @Column({ type: 'int', name: 'updated_by', nullable: true })
  updatedBy!: number | null;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
