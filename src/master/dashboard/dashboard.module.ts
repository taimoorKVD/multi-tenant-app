import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { MasterAuthModule } from '../auth/auth.module';
import { Tenant } from '../tenants/entities';
import { User } from '../users/entities';
import { ActivityLog } from '../activity-logs/entities';
import { EmailLog, GlobalMailSetting } from '../mail/entities';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    MasterAuthModule,
    BillingModule,
    TypeOrmModule.forFeature([Tenant, User, ActivityLog, EmailLog, GlobalMailSetting]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
