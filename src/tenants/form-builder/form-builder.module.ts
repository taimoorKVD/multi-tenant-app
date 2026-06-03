import { Module } from '@nestjs/common';
import {
  FieldTypesController,
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
    FieldTypesController,
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
