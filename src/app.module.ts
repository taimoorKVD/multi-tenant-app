import 'dotenv/config';
import {MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {TenantMiddleware} from './common/middleware';
import {AppController} from './app.controller';
import {MasterModule} from './master/master.module';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true}),
    MasterModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('tenant');
  }
}
