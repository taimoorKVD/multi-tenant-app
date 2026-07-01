import 'dotenv/config';
import {MiddlewareConsumer, Module, NestModule, RequestMethod} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {TenantMiddleware} from './common/middleware';
import {AppController} from './app.controller';
import {MasterModule} from './master/master.module';
import {TenantsModule} from "./tenants/tenants.module";
import { MailModule } from './mail/mail.module';
import { TenantResetService } from './tenant-reset/tenant-reset.service';
import { SystemModule } from './master/system/system.module';

@Module({
  imports: [
      ConfigModule.forRoot({isGlobal: true}),
      MasterModule,
      TenantsModule,
        MailModule,
        SystemModule
  ],
  controllers: [AppController],
  providers: [TenantResetService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
      consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
