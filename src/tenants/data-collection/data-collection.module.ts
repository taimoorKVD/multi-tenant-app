import { Module } from '@nestjs/common';
import { TemplatesController } from './controllers';
import { TemplatesService } from './services';
import { DataCollectionPermissionsGuard } from './guards';

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService, DataCollectionPermissionsGuard],
  exports: [TemplatesService],
})
export class DataCollectionModule {}
