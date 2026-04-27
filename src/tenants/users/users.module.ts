import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TenantAuthModule } from '../auth/auth.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [TenantAuthModule, MailModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
