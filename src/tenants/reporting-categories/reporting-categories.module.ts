import { Module } from '@nestjs/common';
import { ReportingCategoriesController } from './reporting-categories.controller';
import { ReportingCategoriesService } from './reporting-categories.service';

@Module({
  controllers: [ReportingCategoriesController],
  providers: [ReportingCategoriesService],
})
export class ReportingCategoriesModule {}