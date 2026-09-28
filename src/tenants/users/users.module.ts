import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TenantAuthModule } from '../auth/auth.module';
import { MailModule } from '../../mail/mail.module';
import { DynamicFieldsService } from '../form-builder/services';
import { TenantsModule as MasterTenantsModule } from '../../master/tenants/tenants.module';
import { Tenant } from '../../master/tenants/entities';

@Module({
  imports: [
    TenantAuthModule,
    MailModule,
    MasterTenantsModule,
    TypeOrmModule.forFeature([Tenant]),
  ],
  controllers: [UsersController],
  providers: [UsersService, DynamicFieldsService],
})
export class UsersModule {}
