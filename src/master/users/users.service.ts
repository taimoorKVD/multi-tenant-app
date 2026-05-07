import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {MasterAbstractService} from '../../common/abstract';
import {User} from './entities';
import {CreateUserDto, UpdateUserDto} from './dto';
import {Role} from '../role/entities';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService extends MasterAbstractService<User> {
  constructor(
      @InjectRepository(User)
      private readonly userRepo: Repository<User>,
      @InjectRepository(Role)
      private readonly roleRepo: Repository<Role>,
  ) {
    super(userRepo);
  }

  /**
   * Create a new user (using CreateUserDto)
   */
  async create(dto: CreateUserDto) {
    try {
      const { name, email, password, role_id } = dto;

      const existing = await this.userRepo.findOne({ where: { email } });
      if (existing) throw new BadRequestException('A user with this email already exists.');

      const role = await this.roleRepo.findOne({ where: { id: role_id } });
      if (!role) throw new BadRequestException(`Role with ID ${role_id} not found.`);

      const hashedPassword = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });

      const user = this.userRepo.create({
        name,
        email,
        password: hashedPassword,
        role,
      });

      const saved = await this.userRepo.save(user);
      delete (saved as any).password;

      return {
        success: true,
        message: 'User created successfully',
        data: saved,
      };
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to create user: ${err}`);
    }
  }

  /**
   * Update user (using UpdateUserDto)
   */
  async update(id: number, dto: UpdateUserDto) {
    try {
      const user = await this.userRepo.findOne({
        where: { id },
        relations: ['role'],
      });
      if (!user) throw new NotFoundException('User not found.');

      // Update name if provided
      if (dto.name) user.name = dto.name;

      // Hash new password if provided
      if (dto.password) {
        user.password = await argon2.hash(dto.password, {
          type: argon2.argon2id,
          memoryCost: 2 ** 16,
          timeCost: 3,
          parallelism: 1,
        });
      }

      // Reassign role if provided
      if (dto.role_id && dto.role_id !== user.role?.id) {
        const role = await this.roleRepo.findOne({
          where: { id: dto.role_id },
        });
        if (!role) throw new BadRequestException(`Role with ID ${dto.role_id} not found.`);
        user.role = role;
      }

      const saved = await this.userRepo.save(user);
      delete (saved as any).password;

      return {
        success: true,
        message: 'User updated successfully',
        data: saved,
      };
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to update user: ${err}`);
    }
  }

  async search(
    limit = 15,
    filters?: {
      name?: string;
      email?: string;
      roleId?: number;
    },
  ) {
    try {
      const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);
      const name = filters?.name?.trim();
      const email = filters?.email?.trim();
      const roleId = filters?.roleId;
      const hasFilters = Boolean(name || email || roleId);

      if (!hasFilters) {
        return {success: true, count: 0, data: []};
      }

      const qb = this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role');

      if (name) {
        qb.andWhere('user.name ILIKE :name', {name: `%${name}%`});
      }

      if (email) {
        qb.andWhere('user.email ILIKE :email', {email: `%${email}%`});
      }

      if (roleId) {
        qb.andWhere('role.id = :roleId', {roleId});
      }

      const data = await qb.orderBy('user.id', 'DESC').take(take).getMany();
      data.forEach((item: any) => delete item.password);

      return {success: true, count: data.length, data};
    } catch (error) {
      console.error('Master user search failed:', error);
      throw new InternalServerErrorException('Failed to search users');
    }
  }
}
