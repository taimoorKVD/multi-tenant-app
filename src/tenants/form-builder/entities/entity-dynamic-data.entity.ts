import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('entity_dynamic_data')
@Index(['moduleId', 'entityId'])
export class EntityDynamicData {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'module_id' })
  moduleId!: number;

  @Column({ type: 'int', name: 'entity_id' })
  entityId!: number;

  @Column({ type: 'int', name: 'form_version_id', nullable: true })
  formVersionId!: number | null;

  @Column({ type: 'jsonb', name: 'data', default: {} })
  data!: Record<string, any>;

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
