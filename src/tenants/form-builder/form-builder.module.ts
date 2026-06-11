import { Module } from '@nestjs/common';
import {
  FormsController,
  VersionsController,
} from './controllers';
import { PermissionsGuard } from './guards';
import {
  AuditLogService,
  FieldTypesService,
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
    FieldTypesService,
    AuditLogService,
    PermissionsGuard,
  ],
  exports: [FormsService, FieldTypesService],
})
export class FormBuilderModule {}
