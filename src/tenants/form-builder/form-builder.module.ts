import { Module } from '@nestjs/common';
import {
  FormsController,
  VersionsController,
} from './controllers';
import { PermissionsGuard } from './guards';
import {
  AuditLogService,
  DynamicFieldsService,
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
    DynamicFieldsService,
    PermissionsGuard,
  ],
  exports: [FormsService, DynamicFieldsService],
})
export class FormBuilderModule {}
