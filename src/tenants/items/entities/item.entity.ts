import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
// import { JoinColumn, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
// import { Vendor } from '../../vendors/entities';
// import { ReportingCategory } from '../../reporting-categories/entities';

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'item_name', type: 'varchar', length: 150 })
  itemName!: string;

  // @Column({ name: 'item_no', type: 'varchar', unique: true })
  // itemNo!: string;

  // @Column({ type: 'text', nullable: true })
  // description!: string | null;

  // @Column({ type: 'varchar', length: 100, nullable: true })
  // size!: string | null;

  // @Column({ type: 'decimal', precision: 10, scale: 2 })
  // cost!: number;

  // @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  // par!: number | null;

  // @Column({ name: 'vendor_id', type: 'int', nullable: true })
  // vendorId!: number | null;

  // @ManyToOne(() => Vendor, { nullable: true, onDelete: 'SET NULL' })
  // @JoinColumn({ name: 'vendor_id' })
  // vendor!: Vendor | null;

  // @Column({ name: 'is_active', type: 'boolean', default: true })
  // isActive!: boolean;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  // @ManyToMany(() => ReportingCategory, { cascade: false })
  // @JoinTable({
  //   name: 'item_reporting_categories',
  //   joinColumn: { name: 'item_id', referencedColumnName: 'id' },
  //   inverseJoinColumn: { name: 'reporting_category_id', referencedColumnName: 'id' },
  // })
  // reportingCategories!: ReportingCategory[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}