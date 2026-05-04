import {BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import * as argon2 from 'argon2';
import {DataSource} from 'typeorm';
import {User} from '../users/entities';

@Injectable()
export class TenantAuthService {
  private readonly PUBLIC_EMAIL_DOMAINS = new Set([
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'icloud.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
  ]);

  constructor(private readonly jwtService: JwtService) {
  }

  private validateTenantLoginEmail(email: string) {
    const domain = String(email || '').toLowerCase().trim().split('@')[1] || '';

    if (!domain || this.PUBLIC_EMAIL_DOMAINS.has(domain)) {
      throw new BadRequestException(
        'Please sign in using your company email address (for example, user@companyname.com).',
      );
    }
  }

  async login(req: any, dto: { email: string; password: string }) {
    try {
      this.validateTenantLoginEmail(dto.email);

      const tenantConnection: DataSource = req.tenantConnection;
      if (!tenantConnection) {
        throw new BadRequestException('Missing tenant connection');
      }

      const userRepo = tenantConnection.getRepository(User);

      const user = await userRepo.findOne({
        where: {email: dto.email},
        relations: ['role', 'role.permissions'],
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const valid = await argon2.verify(user.password, dto.password);
      if (!valid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const resolvedPermissions = user.role?.permissions ?? [];

      const permissionNames = resolvedPermissions.map((p) => p.name);

      const payload = {
        sub: user.id,
        tenantId: req.tenantId || null,
        tenantDb: tenantConnection.options.database,
        email: user.email,
        role: user.role?.name,
        permissions: permissionNames,
      };

      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '2h',
      });

      return {
        success: true,
        message: 'Login successful',
        tenant_slug: req.tenantId || null,
        tenant: tenantConnection.options.database,
        accessToken: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: {
            ...user.role,
            permissions: resolvedPermissions,
          },
        },
      };

    } catch (error) {
      if (
          error instanceof BadRequestException ||
          error instanceof UnauthorizedException
      ) {
        throw error;
      }

      const err = error instanceof Error ? error : new Error(String(error));

      console.error('Tenant Login Error:', {
        message: err.message,
        stack: err.stack,
      });

      throw new InternalServerErrorException('Something went wrong during login');
    }
  }
}
