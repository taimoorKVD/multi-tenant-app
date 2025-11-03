import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { User } from '../users/entities';

@Injectable()
export class MasterAuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'name'],
      relations: ['role', 'role.permissions'],
    });
    if (!user) return null;
    const match = await argon2.verify(user.password, password);
    return match ? user : null;
  }

  async login(dto) {
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
          role: user.role.name,
        },
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Login error:', error);
      throw new UnauthorizedException(
        'Authentication failed. Please try again.',
      );
    }
  }
}
