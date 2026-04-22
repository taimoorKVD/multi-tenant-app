import {Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn} from 'typeorm';
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

  @CreateDateColumn({name: 'created_at'})
  createdAt!: Date;

  @UpdateDateColumn({name: 'updated_at'})
  updatedAt!: Date;
}
