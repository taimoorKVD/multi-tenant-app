import {Global, Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Tenant} from '../master/tenants/entities';
import {User} from '../master/users/entities';
import {Role} from '../master/role/entities';
import {Permission} from '../master/permission/entities';

@Global()
@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            url: process.env.DATABASE_URL,
            entities: [Tenant, User, Role, Permission],
            synchronize: true,
            ssl: {
                rejectUnauthorized: false,
            },
            extra: {
                ssl: {rejectUnauthorized: false},
            },
        }),
        TypeOrmModule.forFeature([Tenant, User, Role, Permission]),
    ],
    exports: [TypeOrmModule],
})
export class MasterDatabaseModule {
}
