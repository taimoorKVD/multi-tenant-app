import { Module } from '@nestjs/common';
import {
  FormsController,
  VersionsController,
} from './controllers';
import {
  AuditLogService,
  DynamicFieldsService,
  FormsService,
  VersionsService,
} from './services';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [
    FormsController,
    VersionsController,
  ],
  providers: [
    FormsService,
    VersionsService,
    AuditLogService,
    DynamicFieldsService,
  ],
  exports: [FormsService, DynamicFieldsService],
})
export class FormBuilderModule {}
