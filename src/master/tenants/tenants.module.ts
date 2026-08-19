import {Module, forwardRef} from '@nestjs/common';
import {TenantsService} from './tenants.service';
import {TenantsController} from './tenants.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities';
import { BillingModule } from '../billing/billing.module';

@Module({
    imports: [
    TypeOrmModule.forFeature([Tenant]),
    forwardRef(() => BillingModule),
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {
}
