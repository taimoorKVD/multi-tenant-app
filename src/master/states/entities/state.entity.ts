import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {City} from '../../cities/entities';
import {Country} from '../../countries/entities';

@Entity('states')
@Index('IDX_states_country_id', ['countryId'])
export class State {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({type: 'varchar', length: 120})
  name!: string;

  @Column({name: 'country_id', type: 'int'})
  countryId!: number;

  @ManyToOne(() => Country, (country) => country.states, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'country_id'})
  country!: Country;

  @OneToMany(() => City, (city) => city.state)
  cities!: City[];

  @CreateDateColumn({name: 'created_at'})
  createdAt!: Date;

  @UpdateDateColumn({name: 'updated_at'})
  updatedAt!: Date;
}
