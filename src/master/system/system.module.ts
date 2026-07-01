import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantResetService } from 'src/tenant-reset/tenant-reset.service';

@Module({
   imports: [
    TypeOrmModule.forFeature([Tenant]),
    TenantsModule,
  ],
  controllers: [SystemController],
  providers: [TenantResetService],
})
export class SystemModule {}
