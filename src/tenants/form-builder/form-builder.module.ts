import { Module } from '@nestjs/common';
import {
  FormsController,
  VersionsController,
} from './controllers';
import { PermissionsGuard } from './guards';
import {
  AuditLogService,
  FormsService,
  VersionsService,
} from './services';

@Module({
  controllers: [
    FormsController,
    VersionsController,
  ],
  providers: [
    FormsService,
    VersionsService,
    AuditLogService,
    PermissionsGuard,
  ],
  exports: [FormsService],
})
export class FormBuilderModule {}
