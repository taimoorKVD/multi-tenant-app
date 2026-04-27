import { Global, Module } from '@nestjs/common';
import { MasterDatabaseModule } from '../database';
import { QueueModule } from '../queue/queue.module';
import { TemplateModule } from '../template/template.module';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { BaseEmailResolver, OrderEmailResolver, UserEmailResolver } from './resolvers';

@Global()
@Module({
  imports: [MasterDatabaseModule, TemplateModule, QueueModule],
  controllers: [MailController],
  providers: [MailService, BaseEmailResolver, UserEmailResolver, OrderEmailResolver],
  exports: [MailService],
})
export class MailModule {}