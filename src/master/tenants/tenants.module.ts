import {Module, NestModule, MiddlewareConsumer, RequestMethod, forwardRef} from '@nestjs/common';
import {TenantsService} from './tenants.service';
import {TenantsController} from './tenants.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities';
import { BillingModule } from '../billing/billing.module';
import { StripLegacyCreateTenantBodyMiddleware } from './middleware/strip-legacy-create-tenant-body.middleware';

@Module({
    imports: [
    TypeOrmModule.forFeature([Tenant]),
    forwardRef(() => BillingModule),
  ],
  controllers: [TenantsController],
  providers: [TenantsService, StripLegacyCreateTenantBodyMiddleware],
  exports: [TenantsService],
})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(StripLegacyCreateTenantBodyMiddleware)
      .forRoutes({ path: 'master/tenants', method: RequestMethod.POST });
  }
}
