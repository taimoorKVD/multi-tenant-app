import { Module } from '@nestjs/common';
import { TenantMailAdminController } from './tenant-mail-admin.controller';
import { TenantMailAdminService } from './tenant-mail-admin.service';

@Module({
  controllers: [TenantMailAdminController],
  providers: [TenantMailAdminService],
  exports: [TenantMailAdminService],
})
export class TenantMailAdminModule {}
