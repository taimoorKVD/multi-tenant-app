import {DataSourceOptions} from 'typeorm';
import {User} from '../tenants/users/entities';
import {Role} from '../tenants/role/entities';
import {Permission} from '../tenants/permission/entities';
import {Product} from "../tenants/products/entities";

export const tenantDatabaseConfig = (dbName): DataSourceOptions => ({
    type: 'postgres',
    host: process.env.TENANT_DB_HOST_NEON,
    port: Number(process.env.TENANT_DB_PORT_NEON || 5432),
    username: process.env.TENANT_DB_USER_NEON,
    password: process.env.TENANT_DB_PASS_NEON,
    database: dbName,
    entities: [User, Product, Role, Permission],
    ssl:
        process.env.NODE_ENV === 'production'
            ? {rejectUnauthorized: false}
            : false,
    synchronize: true,
    logging: process.env.DB_LOGGING === 'true',
    extra: {
        ssl: {rejectUnauthorized: false},
    },
});
