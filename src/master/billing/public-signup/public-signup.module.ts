import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan, WebsiteSignup } from '../entities';
import { BillingModule } from '../billing.module';
import { TenantsModule } from '../../tenants/tenants.module';
import { PublicSignupController } from './public-signup.controller';
import { PublicSignupService } from './public-signup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebsiteSignup, Plan]),
    forwardRef(() => BillingModule),
    forwardRef(() => TenantsModule),
  ],
  controllers: [PublicSignupController],
  providers: [PublicSignupService],
  exports: [PublicSignupService],
})
export class PublicSignupModule {}
