import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TenantRealtimeGateway } from './gateway/tenant-realtime.gateway';
import { RealtimeService } from './services/realtime.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'tenant_default_secret',
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [TenantRealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
