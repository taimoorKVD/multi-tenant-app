import 'dotenv/config';
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ConfigModule} from '@nestjs/config';
import {TenantsModule} from './master/tenants/tenants.module';
import {Tenant} from "./master/tenants/entities";
import {UsersModule} from './tenants/users/users.module';
import { ProductsModule } from './tenants/products/products.module';

@Module({
    imports: [
        ConfigModule.forRoot({isGlobal: true}),
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.MASTER_DB_HOST,
            port: Number(process.env.MASTER_DB_PORT),
            username: process.env.MASTER_DB_USER,
            password: process.env.MASTER_DB_PASS,
            database: process.env.MASTER_DB_NAME,
            entities: [Tenant],
            synchronize: true,
            ssl: {
                rejectUnauthorized: false,
            },
            extra: {
                ssl: {
                    rejectUnauthorized: false,
                },
            },
        }),
        TenantsModule,
        UsersModule,
        ProductsModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {
}
