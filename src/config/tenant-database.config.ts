import {DataSourceOptions} from 'typeorm';
import {User} from '../tenants/users/entities';
import {Role} from '../tenants/role/entities';
import {Permission} from '../tenants/permission/entities';
import {Product} from '../tenants/products/entities';

export const tenantDatabaseConfig = (dbName: string): DataSourceOptions => {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
        type: 'postgres',
        host: process.env.TENANT_DB_HOST_NEON || 'localhost',
        port: Number(process.env.TENANT_DB_PORT_NEON || 5432),
        username: process.env.TENANT_DB_USER_NEON || 'postgres',
        password: process.env.TENANT_DB_PASS_NEON || 'password',
        database: dbName,
        entities: [User, Product, Role, Permission],
        synchronize: true,
        logging: process.env.DB_LOGGING === 'true',
        ssl: isProduction ? { rejectUnauthorized: false } : false,
        ...(isProduction
            ? {
                extra: {
                    ssl: { rejectUnauthorized: false },
                },
            }
            : {}),
    };
};
