import { Module } from '@nestjs/common';
import { FormBuilderModule } from '../form-builder';
import { ReportingCategoriesController } from './reporting-categories.controller';
import { ReportingCategoriesService } from './reporting-categories.service';

@Module({
  imports: [FormBuilderModule],
  controllers: [ReportingCategoriesController],
  providers: [ReportingCategoriesService],
})
export class ReportingCategoriesModule {}
