import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import {Role} from "../../role/entities";
import {Exclude} from "class-transformer";

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({length: 100})
    name: string;

    @Column({unique: true})
    email: string;

    @Exclude()
    @Column()
    password: string;

    @ManyToOne(() => Role)
    @JoinColumn({name: 'role_id'})
    role: Role;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
