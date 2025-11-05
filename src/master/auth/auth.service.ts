import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { User } from '../users/entities';
import { LoginDto } from './dto';
import { UpdateUserDto } from '../users/dto';

@Injectable()
export class MasterAuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

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
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new BadRequestException('User not found');

    if (dto.name) user.name = dto.name;
    if (dto.email) user.email = dto.email;

    if (dto.password) {
      if (dto.password_confirm !== dto.password)
        throw new BadRequestException('Passwords do not match');
      user.password = await argon2.hash(dto.password);
    }

    const saved = await this.userRepo.save(user);
    delete (saved as any).password;

    return saved;
  }
}
