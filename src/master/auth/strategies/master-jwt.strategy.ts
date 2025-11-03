import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MasterJwtStrategy extends PassportStrategy(
  Strategy,
  'master-jwt',
) {
  constructor(private readonly configService: ConfigService) {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:
        configService.get('MASTER_JWT_SECRET') || 'master_default_secret',
      ignoreExpiration: false,
    };

    super(options);
  }

  async validate(payload: any) {
    return payload; // attaches to req.user
  }
}
