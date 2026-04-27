import { Module } from '@nestjs/common';
import { MasterDatabaseModule } from '../../database';
import { QueueModule } from '../../queue/queue.module';
import { MailAdminController } from './mail-admin.controller';
import { MailAdminService } from './mail-admin.service';

@Module({
  imports: [MasterDatabaseModule, QueueModule],
  controllers: [MailAdminController],
  providers: [MailAdminService],
  exports: [MailAdminService],
})
export class MailAdminModule {}