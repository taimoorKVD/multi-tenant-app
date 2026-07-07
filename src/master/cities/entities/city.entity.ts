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
import {Country} from '../../countries/entities';
import {State} from '../../states/entities';

@Entity('cities')
@Index('IDX_cities_state_id', ['stateId'])
@Index('IDX_cities_country_id', ['countryId'])
export class City {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({type: 'varchar', length: 120})
  name!: string;

  @Column({name: 'state_id', type: 'int'})
  stateId!: number;

  @Column({name: 'country_id', type: 'int'})
  countryId!: number;

  @ManyToOne(() => State, (state) => state.cities, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'state_id'})
  state!: State;

  @ManyToOne(() => Country, (country) => country.cities, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'country_id'})
  country!: Country;

  @CreateDateColumn({name: 'created_at'})
  createdAt!: Date;

  @UpdateDateColumn({name: 'updated_at'})
  updatedAt!: Date;
}
