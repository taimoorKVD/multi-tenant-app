import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Plan, WebsiteSignup } from '../entities';
import { BillingModule } from '../billing.module';
import { TenantsModule } from '../../tenants/tenants.module';
import { PublicSignupController } from './public-signup.controller';
import { PublicSignupService } from './public-signup.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([WebsiteSignup, Plan]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'tenant_default_secret',
        signOptions: { expiresIn: '2h' },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => BillingModule),
    forwardRef(() => TenantsModule),
  ],
  controllers: [PublicSignupController],
  providers: [PublicSignupService],
  exports: [PublicSignupService],
})
export class PublicSignupModule {}
