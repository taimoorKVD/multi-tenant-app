import {BadRequestException, Injectable, InternalServerErrorException} from '@nestjs/common';
import {DataSource, Repository} from 'typeorm';
import {User} from "./entities";
import {TenantAbstractService} from "../../common/abstract";
import {Role} from "../role/entities";
import {CreateUserDto} from "./dto";
import * as argon2 from 'argon2';

@Injectable()
export class UsersService extends TenantAbstractService<User> {
    constructor(private readonly dataSource: DataSource) {
        super(dataSource.getRepository(User));
    }

    async create(req: any, dto: CreateUserDto): Promise<any> {
        try {
            const userRepo: Repository<User> = this.getRepo(req);
            const roleRepo: Repository<Role> = req.tenantConnection.getRepository(Role);

            const {name, email, password, role_id} = dto;

            const existing = await userRepo.findOne({where: {email}});
            if (existing)
                throw new BadRequestException('A user with this email already exists.');

            const hashedPassword = await argon2.hash(password, {
                type: argon2.argon2id,
                memoryCost: 2 ** 16,
                timeCost: 3,
                parallelism: 1,
            });

            let role: Role | null = null;
            if (role_id) {
                role = await roleRepo.findOne({where: {id: role_id}});
                if (!role)
                    throw new BadRequestException(`Role with ID ${role_id} not found.`);
            }

            const user = userRepo.create({
                name,
                email,
                password: hashedPassword,
                ...(role ? {role} : {}),
            });

            const saved = await userRepo.save(user);
            delete (saved as any).password;

            return {
                success: true,
                message: 'Tenant user created successfully',
                tenant: req.tenantConnection.options.database,
                data: saved,
            };
        } catch (error) {
            console.error('❌ Tenant user creation failed:', error);
            throw new InternalServerErrorException(
                `Failed to create tenant user: ${error.message}`,
            );
        }
    }
}
