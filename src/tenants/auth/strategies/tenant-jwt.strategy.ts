import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TenantJwtStrategy extends PassportStrategy(Strategy, 'tenant-jwt') {
    constructor(private readonly configService: ConfigService) {
        const options: StrategyOptions = {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: configService.get('JWT_SECRET') || 'tenant_default_secret',
            ignoreExpiration: false,
        };

        super(options);
    }

    async validate(payload: any) {
        // Attach to req.user
        return payload;
    }
}
