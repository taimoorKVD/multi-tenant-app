import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  /** Module key, e.g. "users", "billing". API responses nest this as `{ name }`. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  module: string | null;
}
