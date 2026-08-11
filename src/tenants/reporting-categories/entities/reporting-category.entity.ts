import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReportingGroup } from '../../reporting-groups/entities';
import { Item } from '../../items/entities';

@Entity('reporting_categories')
export class ReportingCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'reporting_group_id', type: 'int' })
  reportingGroupId!: number;

  @ManyToOne(() => ReportingGroup, (group) => group.reportingCategories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporting_group_id' })
  reportingGroup!: ReportingGroup;

  @Column({ type: 'varchar', length: 150, unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  @ManyToMany(() => Item, (item) => item.reportingCategories)
  items!: Item[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
