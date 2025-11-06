import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
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
   * ✅ Create a new user (using CreateUserDto)
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
      throw new BadRequestException(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * ✅ Update user (using UpdateUserDto)
   */
  async update(id: number, dto: UpdateUserDto) {
    try {
      const user = await this.userRepo.findOne({
        where: { id },
        relations: ['role'],
      });
      if (!user) throw new NotFoundException('User not found.');

      // Update email if provided
      if (dto.email && dto.email !== user.email) {
        const existing = await this.userRepo.findOne({
          where: { email: dto.email },
        });
        if (existing) throw new BadRequestException('Email already in use by another user.');
        user.email = dto.email;
      }

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
      throw new BadRequestException(`Failed to update user: ${error.message}`);
    }
  }

  async updateProfile(userId: number, dto: UpdateUserDto) {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['role'],
      });

      if (!user) throw new NotFoundException('User not found.');

      // 🧹 Sanitize DTO fields
      const cleanDto = { ...dto };
      delete (cleanDto as any).password_confirm;
      delete (cleanDto as any).role_id;
      delete (cleanDto as any).id;

      Object.keys(cleanDto).forEach((key) => {
        if (cleanDto[key] === '' || cleanDto[key] === null || Number.isNaN(cleanDto[key])) {
          delete cleanDto[key];
        }
      });

      // ✅ Update name if provided
      if (cleanDto.name && cleanDto.name.trim() !== '') {
        user.name = cleanDto.name.trim();
      }

      // ✅ Prevent duplicate email
      if (cleanDto.email && cleanDto.email !== user.email) {
        const existing = await this.userRepo.findOne({
          where: { email: cleanDto.email },
        });
        if (existing) throw new BadRequestException('Email already in use.');
        user.email = cleanDto.email;
      }

      // ✅ Update password only if provided and non-empty
      if (cleanDto.password && cleanDto.password.trim() !== '') {
        user.password = await argon2.hash(cleanDto.password, {
          type: argon2.argon2id,
          memoryCost: 2 ** 16,
          timeCost: 3,
          parallelism: 1,
        });
      }

      // ✅ Save updates
      const saved = await this.userRepo.save(user);
      delete (saved as any).password;

      return {
        success: true,
        message: 'Profile updated successfully',
        data: saved,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to update profile: ${error.message}`);
    }
  }
}
