import {Module} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {MasterAuthModule} from './auth/auth.module';
import {UsersModule} from './users/users.module';
import {RoleModule} from './role/role.module';
import {PermissionModule} from './permission/permission.module';
import {TenantsModule} from './tenants/tenants.module';
import {JobPositionModule} from './job-position/job-position.module';
import {MasterDatabaseModule} from "../database";
import {TenantsService} from "./tenants/tenants.service";
import {JwtService} from "@nestjs/jwt";
import {CountriesModule} from './countries/countries.module';
import {CitiesModule} from './cities/cities.module';
import {StatesModule} from './states/states.module';
import {MailAdminModule} from './mail/mail-admin.module';
import { ActivityLogsModule } from './activity-logs';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { SystemModule } from './system/system.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BillingModule } from './billing/billing.module';
import { PublicSignupModule } from './billing/public-signup/public-signup.module';

@Module({
  imports: [
    MasterDatabaseModule,
    MasterAuthModule,
    PermissionModule,
    RoleModule,
    UsersModule,
    TenantsModule,
    JobPositionModule,
    CountriesModule,
    CitiesModule,
    StatesModule,
    MailAdminModule,
    ActivityLogsModule,
    SystemModule,
    DashboardModule,
    BillingModule,
    PublicSignupModule,
  ],
  providers: [
    TenantsService,
    JwtService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],
  exports: [TenantsService, JwtService],
})
export class MasterModule {}
