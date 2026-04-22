import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {State} from '../../states/entities';

@Entity('countries')
export class Country {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({type: 'varchar', length: 120, unique: true})
  name!: string;

  @Column({type: 'varchar', length: 10, unique: true, nullable: true})
  code!: string | null;

  @OneToMany(() => State, (state) => state.country)
  states!: State[];

  @CreateDateColumn({name: 'created_at'})
  createdAt!: Date;

  @UpdateDateColumn({name: 'updated_at'})
  updatedAt!: Date;
}
