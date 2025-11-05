import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities';
import { TenantAbstractService } from '../../common/abstract';
import { Role } from '../role/entities';
import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService extends TenantAbstractService<User> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(User));
  }

  async create(req: any, dto: CreateUserDto): Promise<any> {
    try {
      const userRepo: Repository<User> = this.getRepo(req);
      const roleRepo: Repository<Role> =
        req.tenantConnection.getRepository(Role);

      const { name, email, password, role_id } = dto;

      const existing = await userRepo.findOne({ where: { email } });
      if (existing)
        throw new BadRequestException('A user with this email already exists.');

      let role: Role | null = null;
      if (role_id) {
        role = await roleRepo.findOne({ where: { id: role_id } });
        if (!role)
          throw new BadRequestException(`Role with ID ${role_id} not found.`);
      }

      const user = userRepo.create({
        name,
        email,
        password,
        ...(role ? { role } : {}),
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

  async update(req: any, id: number, dto: UpdateUserDto): Promise<any> {
    try {
      const userRepo: Repository<User> = this.getRepo(req);
      const roleRepo: Repository<Role> =
        req.tenantConnection.getRepository(Role);

      const user = await userRepo.findOne({
        where: { id },
        relations: ['role'],
      });
      if (!user) throw new NotFoundException(`User with ID ${id} not found.`);

      if (dto.email && dto.email !== user.email) {
        const existing = await userRepo.findOne({
          where: { email: dto.email },
        });
        if (existing)
          throw new BadRequestException(
            'Email already in use by another user.',
          );
        user.email = dto.email;
      }

      if (dto.name) user.name = dto.name;

      if (dto.role_id && dto.role_id !== user.role?.id) {
        const newRole = await roleRepo.findOne({ where: { id: dto.role_id } });
        if (!newRole)
          throw new BadRequestException(
            `Role with ID ${dto.role_id} not found.`,
          );
        user.role = newRole;
      }

      const updated = await userRepo.save(user);
      delete (updated as any).password;

      return {
        success: true,
        message: 'Tenant user updated successfully',
        tenant: req.tenantConnection.options.database,
        data: updated,
      };
    } catch (error) {
      console.error('❌ Tenant user update failed:', error);
      throw new InternalServerErrorException(
        `Failed to update tenant user: ${error.message}`,
      );
    }
  }
}
