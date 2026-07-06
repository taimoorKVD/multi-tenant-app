import { Module } from '@nestjs/common';
import { DynamicFieldsService } from '../form-builder/services';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';

@Module({
  controllers: [VendorsController],
  providers: [VendorsService, DynamicFieldsService],
  exports: [VendorsService],
})
export class VendorsModule {}
