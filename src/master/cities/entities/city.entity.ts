import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {State} from '../../states/entities';

@Entity('cities')
@Index('IDX_cities_state_id', ['stateId'])
export class City {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({type: 'varchar', length: 120})
  name!: string;

  @Column({name: 'state_id', type: 'int'})
  stateId!: number;

  @ManyToOne(() => State, (state) => state.cities, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'state_id'})
  state!: State;

  @CreateDateColumn({name: 'created_at'})
  createdAt!: Date;

  @UpdateDateColumn({name: 'updated_at'})
  updatedAt!: Date;
}