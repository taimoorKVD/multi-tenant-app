import 'dotenv/config';
import {MiddlewareConsumer, Module, NestModule, RequestMethod} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {TenantMiddleware} from './common/middleware';
import {AppController} from './app.controller';
import {MasterModule} from './master/master.module';
import {TenantsModule} from "./tenants/tenants.module";
import { MailModule } from './mail/mail.module';
import { TenantResetService } from './tenant-reset/tenant-reset.service';
import { HealthController } from './health.controller';
import { SystemModule } from './master/system/system.module';
import { RealtimeModule } from './realtime';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantAuditContextInterceptor } from './common/interceptors/tenant-audit-context.interceptor';


@Module({
  imports: [
      ConfigModule.forRoot({isGlobal: true}),
      MasterModule,
      TenantsModule,
        MailModule,
        SystemModule,
        RealtimeModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    TenantResetService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantAuditContextInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
      consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
