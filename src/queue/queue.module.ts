import { Module } from '@nestjs/common';
import { MasterDatabaseModule } from '../database';
import { QueueService } from './queue.service';
import { EmailDispatchService } from './email-dispatch.service';
import { EmailWorker } from './email.worker';

@Module({
  imports: [MasterDatabaseModule],
  providers: [QueueService, EmailDispatchService, EmailWorker],
  exports: [QueueService, EmailDispatchService, EmailWorker],
})
export class QueueModule {}