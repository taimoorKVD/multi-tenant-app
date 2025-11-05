import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantAuthService } from './auth.service';
import { TenantAuthController } from './auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TenantJwtStrategy } from './strategies/tenant-jwt.strategy';
import { TenantAuthGuard } from './guards';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'tenant-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'tenant_default_secret',
        signOptions: { expiresIn: '2h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [TenantAuthController],
  providers: [TenantAuthService, TenantJwtStrategy, TenantAuthGuard],
  exports: [TenantAuthService, TenantJwtStrategy, TenantAuthGuard],
})
export class TenantAuthModule {}
