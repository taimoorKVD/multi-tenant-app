import 'dotenv/config';
import {MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {TenantMiddleware} from "./common/middleware";
import {AppController} from "./app.controller";
import {MasterModule} from "./master/master.module";
import {MasterDatabaseModule} from "./database";
import {TenantsModule} from "./tenants/tenants.module";

@Module({
    imports: [
        ConfigModule.forRoot({isGlobal: true}),
        MasterDatabaseModule,
        MasterModule,
        TenantsModule
    ],
    controllers: [AppController],
    providers: [],
})

export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(TenantMiddleware).forRoutes('tenant');
    }
}