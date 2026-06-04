import { Module } from '@nestjs/common';
import {
  FormsController,
  SubmissionsController,
  VersionsController,
} from './controllers';
import { PermissionsGuard } from './guards';
import {
  AuditLogService,
  FieldTypesService,
  FormsService,
  SubmissionIndexService,
  SubmissionsService,
  ValidationService,
  VersionsService,
} from './services';

@Module({
  controllers: [
    FormsController,
    SubmissionsController,
    VersionsController,
  ],
  providers: [
    FormsService,
    SubmissionsService,
    VersionsService,
    FieldTypesService,
    SubmissionIndexService,
    ValidationService,
    AuditLogService,
    PermissionsGuard,
  ],
  exports: [FormsService, FieldTypesService],
})
export class FormBuilderModule {}
