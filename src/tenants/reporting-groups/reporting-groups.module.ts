import { Module } from '@nestjs/common';
import { ReportingGroupsController } from './reporting-groups.controller';
import { ReportingGroupsService } from './reporting-groups.service';

@Module({
  controllers: [ReportingGroupsController],
  providers: [ReportingGroupsService],
})
export class ReportingGroupsModule {}