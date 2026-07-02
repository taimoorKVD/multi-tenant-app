import {Module} from '@nestjs/common';
import {TenantsService} from './tenants.service';
import {TenantsController} from './tenants.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities';

@Module({
    imports: [
    TypeOrmModule.forFeature([Tenant]), // 👈 Required
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {
}
