import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { DynamicFieldsService } from '../form-builder/services';

@Module({
  controllers: [ItemsController],
  providers: [ItemsService, DynamicFieldsService],
})
export class ItemsModule {}
