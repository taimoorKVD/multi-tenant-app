import { Module } from '@nestjs/common';
import { MasterModule } from '../master/master.module';
import { MasterDatabaseModule } from '../database';
import { TemplateService } from './template.service';

@Module({
  imports: [MasterDatabaseModule, MasterModule],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}