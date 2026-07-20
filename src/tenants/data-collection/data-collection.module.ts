import { Module } from '@nestjs/common';
import { TemplatesController, TemplateVersionsController } from './controllers';
import { TemplatesService, TemplateVersionsService } from './services';
import { DataCollectionPermissionsGuard } from './guards';

@Module({
  controllers: [TemplatesController, TemplateVersionsController],
  providers: [TemplatesService, TemplateVersionsService, DataCollectionPermissionsGuard],
  exports: [TemplatesService, TemplateVersionsService],
})
export class DataCollectionModule {}
