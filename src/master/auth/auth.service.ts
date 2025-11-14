import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {Repository} from 'typeorm';
import {InjectRepository} from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import {User} from '../users/entities';
import {LoginDto} from './dto';
import {UpdateUserDto} from '../users/dto';

@Injectable()
export class MasterAuthService {
  constructor(
      @InjectRepository(User)
      private readonly userRepo: Repository<User>,
      private readonly jwtService: JwtService,
  ) {
  }

  /** ✅ Validate user credentials */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'name', 'role'],
      relations: ['role', 'role.permissions'],
    });

    if (!user) return null;

    const match = await argon2.verify(user.password, password);
    return match ? user : null;
  }

  async login(dto: LoginDto) {
    try {
      const user = await this.validateUser(dto.email, dto.password);
      if (!user) throw new UnauthorizedException('Invalid credentials');

      const payload = { sub: user.id, email: user.email, role: user.role };
      const access_token = this.jwtService.sign(payload);

      return {
        success: true,
        message: 'User successfully authenticated',
        access_token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role?.name,
          // permissions: user.role?.permissions?.map((p) => p.name) || [],
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Login error:', error);
      throw new UnauthorizedException('Authentication failed. Please try again.');
    }
  }

  /** ✅ Get current logged-in user (from token) */
  async getProfile(userId: number): Promise<{
    id: number;
    name: string;
    email: string;
    role?: string;
    createdAt: Date;
    updatedAt: Date;
    // permissions: string[];
  }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    // console.log(user);

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      // permissions: user.role?.permissions?.map((p) => p.name) || [],
    };
  }

  async updateProfile(id: number, dto: UpdateUserDto) {
    try {
      const user = await this.userRepo.findOne({where: {id}});
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (dto.name) {
        const trimmed = dto.name.trim();
        if (!trimmed) {
          throw new BadRequestException('Name cannot be empty');
        }
        user.name = trimmed;
      }

      if (dto.password) {
        if (!dto.password_confirm) {
          throw new BadRequestException('Confirm password is required');
        }
        if (dto.password !== dto.password_confirm) {
          throw new BadRequestException('Passwords do not match');
        }

        if (dto.password.length < 6) {
          throw new BadRequestException(
              'Password must be at least 6 characters long',
          );
        }

        user.password = await argon2.hash(dto.password);
      }

      const saved = await this.userRepo.save(user).catch((error) => {
        console.error('Error saving user profile:', error);
        throw new InternalServerErrorException(
            'Unable to update profile at this time. Please try again later.',
        );
      });

      delete (saved as any).password;

      return {
        success: true,
        message: 'Profile updated successfully',
        data: saved,
      };
    } catch (error) {
      if (
          error instanceof NotFoundException ||
          error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Unexpected error in updateProfile:', error);
      throw new InternalServerErrorException(
          'Something went wrong while updating your profile.',
      );
    }
  }
}
