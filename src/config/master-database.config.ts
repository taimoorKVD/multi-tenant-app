import {DataSourceOptions} from 'typeorm';
import {User} from '../master/users/entities';
import {Role} from '../master/role/entities';
import {Permission} from '../master/permission/entities';
import {Tenant} from '../master/tenants/entities';

export const masterDatabaseConfig = (): DataSourceOptions => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User, Role, Permission, Tenant],
    ssl:
        process.env.NODE_ENV === 'production'
            ? {rejectUnauthorized: false}
            : false,
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
    extra: {
        ssl: {rejectUnauthorized: false},
    },
});
