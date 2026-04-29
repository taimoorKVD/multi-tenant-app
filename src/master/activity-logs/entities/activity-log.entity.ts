import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('activity_logs')
@Index(['createdAt'])
@Index(['userId'])
@Index(['statusCode'])
@Index(['method', 'endpoint'])
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tenant!: string | null;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId!: number | null;

  @Column({ name: 'user_email', type: 'varchar', length: 255, nullable: true })
  userEmail!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  action!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  module!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  entity!: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 100, nullable: true })
  entityId!: string | null;

  @Column({ type: 'varchar', length: 10 })
  method!: string;

  @Column({ type: 'varchar', name: 'endpoint', length: 500 })
  endpoint!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  status!: string | null;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode!: number | null;

  @Column({ name: 'duration_ms', type: 'int' })
  durationMs!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent!: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  requestId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  query!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  body!: Record<string, unknown> | null;

  @Column({ name: 'old_data', type: 'jsonb', nullable: true })
  oldData!: Record<string, unknown> | null;

  @Column({ name: 'new_data', type: 'jsonb', nullable: true })
  newData!: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
