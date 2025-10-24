import {DataSource} from 'typeorm';
import {User} from '../tenants/users/entities';
import {Product} from '../tenants/products/entities';
import {Role} from '../tenants/role/entities';
import {Permission} from "../tenants/permission/entities";

export const tenantConnections: Record<string, DataSource> = {};

export async function getTenantDataSource(dbName: string): Promise<DataSource> {
    if (tenantConnections[dbName]) {
        return tenantConnections[dbName];
    }

    const dataSource = new DataSource({
        type: 'postgres',

        // host: process.env.TENANT_DB_HOST,
        // port: Number(process.env.TENANT_DB_PORT || 5432),
        // username: process.env.TENANT_DB_USER,
        // password: process.env.TENANT_DB_PASS,

        host: process.env.TENANT_DB_HOST_NEON,
        port: Number(process.env.TENANT_DB_PORT_NEON || 5432),
        username: process.env.TENANT_DB_USER_NEON,
        password: process.env.TENANT_DB_PASS_NEON,

        database: dbName,
        entities: [User, Product, Role, Permission],
        synchronize: true,
        ssl: {
            rejectUnauthorized: false,
        },
        extra: {
            ssl: {
                rejectUnauthorized: false,
            },
        },
    });

    await dataSource.initialize();
    tenantConnections[dbName] = dataSource;
    console.log(`✅ Tenant DB connected: ${dbName}`);
    return dataSource;
}
