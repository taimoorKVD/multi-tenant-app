import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MasterDatabaseModule } from '../../database';
import { TenantsModule as MasterTenantsModule } from '../../master/tenants/tenants.module';
import { Tenant } from '../../master/tenants/entities';
import {
  TemplatesController,
  TemplateVersionsController,
  AssignmentsController,
  SubmissionsController,
  DataCollectionCronController,
  ManagerReportController,
} from './controllers';
import {
  TemplatesService,
  TemplateVersionsService,
  FrequencyService,
  AssignmentsService,
  SubmissionsService,
  SubmissionFlagsService,
  WorkflowActionsService,
  AssignmentReminderService,
  WorkflowRuleEngineService,
  ManagerReportService,
} from './services';
import { CronSecretGuard, DataCollectionPermissionsGuard } from './guards';

@Module({
  imports: [
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
    DataCollectionCronController,
    ManagerReportController,
  ],
  providers: [
    TemplatesService,
    TemplateVersionsService,
    FrequencyService,
    AssignmentsService,
    SubmissionsService,
    SubmissionFlagsService,
    WorkflowActionsService,
    AssignmentReminderService,
    WorkflowRuleEngineService,
    ManagerReportService,
    DataCollectionPermissionsGuard,
    CronSecretGuard,
  ],
  exports: [
    TemplatesService,
    TemplateVersionsService,
    FrequencyService,
    AssignmentsService,
    SubmissionsService,
    SubmissionFlagsService,
    AssignmentReminderService,
    WorkflowRuleEngineService,
    ManagerReportService,
  ],
})
export class DataCollectionModule {}
