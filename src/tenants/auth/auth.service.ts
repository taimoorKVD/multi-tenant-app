import {BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import * as argon2 from 'argon2';
import {DataSource} from 'typeorm';
import {User} from '../users/entities';
import {Permission} from '../permission/entities';

@Injectable()
export class TenantAuthService {
  constructor(private readonly jwtService: JwtService) {
  }

  async login(req: any, dto: { email: string; password: string }) {
    try {
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

      const roleName = user.role?.name?.trim().toLowerCase() ?? '';
      const isTenantAdminUser =
        roleName === 'admin' ||
        roleName === 'super admin' ||
        (typeof user.email === 'string' && user.email.toLowerCase().startsWith('admin@'));

      let resolvedPermissions = user.role?.permissions ?? [];
      if (isTenantAdminUser) {
        // Tenant admins should always receive full tenant permissions in their auth context.
        resolvedPermissions = await tenantConnection.getRepository(Permission).find();
      }

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
