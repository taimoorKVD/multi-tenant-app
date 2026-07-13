import {Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,} from 'typeorm';

@Entity('locations')
export class Location {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({unique: true})
    name: string;

    @Column({nullable: true})
    address: string;

    @Column({ name: 'country_id', type: 'int', nullable: true })
    countryId?: number;

    @Column({ name: 'state_id', type: 'int', nullable: true })
    stateId?: number;

    @Column({ name: 'city_id', type: 'int', nullable: true })
    cityId?: number;

    @Column({nullable: true})
    postalCode: string;

    @Column({nullable: true})
    latitude: string;

    @Column({nullable: true})
    longitude: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
