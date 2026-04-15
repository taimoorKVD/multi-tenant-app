import {
    Column,
    CreateDateColumn,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {Permission} from '../../permission/entities';

@Entity('job_positions')
export class JobPosition {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({length: 100, unique: true})
    name: string;

    @Column('text', {nullable: true})
    description: string | null;

    @ManyToMany(() => Permission)
    @JoinTable({
        name: 'job_position_permissions',
        joinColumn: {name: 'job_position_id', referencedColumnName: 'id'},
        inverseJoinColumn: {name: 'permission_id', referencedColumnName: 'id'},
    })
    permissions: Permission[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
