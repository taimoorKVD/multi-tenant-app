import 'dotenv/config';
import {MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {TenantsModule} from './master/tenants/tenants.module';
import {TenantMiddleware} from "./common/middleware";
import {AppController} from "./app.controller";
import {MasterModule} from "./master/master.module";
import {MasterDatabaseModule} from "./database";

@Module({
    imports: [
        ConfigModule.forRoot({isGlobal: true}),
        MasterDatabaseModule,
        MasterModule,
        TenantsModule,
    ],
    controllers: [AppController],
    providers: [],
})

export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(TenantMiddleware).forRoutes('tenant');
    }
}