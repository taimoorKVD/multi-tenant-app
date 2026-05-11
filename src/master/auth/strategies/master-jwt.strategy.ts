import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface MasterJwtPayload {
  sub: number; // user ID
  email: string;
  role?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class MasterJwtStrategy extends PassportStrategy(Strategy, 'master-jwt') {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('MASTER_JWT_SECRET');
    if (!secret) {
      throw new Error('MASTER_JWT_SECRET is not configured');
    }
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('MASTER_JWT_SECRET') || 'master_default_secret',
      ignoreExpiration: false,
    };

    super(options);
  }

  validate(payload: MasterJwtPayload) {
    if (!payload?.sub || !payload?.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Return minimal user for req.user
    return {
      id: payload.sub,
      email: payload.email,
      role: {
        name: payload.role ?? 'User',
        permissions: payload.permissions ?? [],
      },
    };
  }
}
