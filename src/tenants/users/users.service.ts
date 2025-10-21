import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import {User} from './entities';
import {DataSource, Repository} from 'typeorm';

@Injectable()
export class UsersService {
    private getRepo(req: any): Repository<User> {
        const tenantConnection: DataSource = req?.tenantConnection;
        if (!tenantConnection) {
            throw new BadRequestException('Tenant connection not found. Ensure x-tenant-id header is provided.');
        }
        return tenantConnection.getRepository(User);
    }

    async create(req: any, data: Partial<User>) {
        try {
            const repo = this.getRepo(req);
            const user = repo.create(data);
            await repo.save(user);

            return {
                success: true,
                message: 'User created successfully',
                tenant: req.tenantConnection.options.database,
                data: user,
            };
        } catch (error) {
            console.error('❌ User creation failed:', error);
            throw new InternalServerErrorException('Failed to create user');
        }
    }

    async findAll(req: any) {
        try {
            const repo = this.getRepo(req);
            const users = await repo.find({order: {id: 'DESC'}});

            return {
                success: true,
                tenant: req.tenantConnection.options.database,
                count: users.length,
                data: users,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to retrieve users');
        }
    }

    async findOne(req: any, id: number) {
        try {
            const repo = this.getRepo(req);
            const user = await repo.findOneBy({id});
            if (!user) throw new NotFoundException(`User with ID ${id} not found`);

            return {
                success: true,
                tenant: req.tenantConnection.options.database,
                data: user,
            };
        } catch (error) {
            throw error;
        }
    }

    async update(req: any, id: number, data: Partial<User>) {
        try {
            const repo = this.getRepo(req);
            const user = await repo.findOneBy({id});
            if (!user) throw new NotFoundException(`User with ID ${id} not found`);

            await repo.update(id, data);
            const updated = await repo.findOneBy({id});

            return {
                success: true,
                message: 'User updated successfully',
                tenant: req.tenantConnection.options.database,
                data: updated,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to update user');
        }
    }

    async remove(req: any, id: number) {
        try {
            const repo = this.getRepo(req);
            const user = await repo.findOneBy({id});
            if (!user) throw new NotFoundException(`User with ID ${id} not found`);

            await repo.delete(id);

            return {
                success: true,
                message: 'User deleted successfully',
                tenant: req.tenantConnection.options.database,
                deletedId: id,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to delete user');
        }
    }
}
