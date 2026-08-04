import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MailModule } from '../../mail/mail.module';
import { MasterDatabaseModule } from '../../database';
import { TenantsModule as MasterTenantsModule } from '../../master/tenants/tenants.module';
import { Tenant } from '../../master/tenants/entities';
import {
  TemplatesController,
  TemplateVersionsController,
  AssignmentsController,
  SubmissionsController,
} from './controllers';
import {
  TemplatesService,
  TemplateVersionsService,
  FrequencyService,
  AssignmentsService,
  SubmissionsService,
  WorkflowActionsService,
  AssignmentReminderService,
} from './services';
import { DataCollectionPermissionsGuard } from './guards';

@Module({
  imports: [
    MailModule,
    MasterDatabaseModule,
    MasterTenantsModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Tenant]),
  ],
  controllers: [
    TemplatesController,
    TemplateVersionsController,
    AssignmentsController,
    SubmissionsController,
  ],
  providers: [
    TemplatesService,
    TemplateVersionsService,
    FrequencyService,
    AssignmentsService,
    SubmissionsService,
    WorkflowActionsService,
    AssignmentReminderService,
    DataCollectionPermissionsGuard,
  ],
  exports: [
    TemplatesService,
    TemplateVersionsService,
    FrequencyService,
    AssignmentsService,
    SubmissionsService,
    AssignmentReminderService,
  ],
})
export class DataCollectionModule {}
