import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { User } from '../users/entities';

@Injectable()
export class TenantAuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(req: any, dto: { email: string; password: string }) {
    const tenantConnection: DataSource = req.tenantConnection;

    if (!tenantConnection) {
      throw new BadRequestException('Missing tenant connection');
    }

    const userRepo = tenantConnection.getRepository(User);
    const user = await userRepo.findOne({
      where: { email: dto.email },
      relations: ['role', 'role.permissions'],
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.password, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // Prepare JWT payload
    const payload = {
      sub: user.id,
      tenantDb: tenantConnection.options.database,
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions.map((p) => p.name),
    };

    const token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '2h',
    });

    return {
      success: true,
      message: 'Login successful',
      tenant: tenantConnection.options.database,
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
      },
    };
  }
}
