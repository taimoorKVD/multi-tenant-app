import {DataSource} from 'typeorm';
import {User} from '../tenants/users/entities/user.entity';
import {Product} from '../tenants/products/entities/product.entity';

export const tenantConnections: Record<string, DataSource> = {};

export async function getTenantDataSource(dbName: string): Promise<DataSource> {
    if (tenantConnections[dbName]) {
        return tenantConnections[dbName];
    }

    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.TENANT_DB_HOST,
        port: Number(process.env.TENANT_DB_PORT || 5432),
        username: process.env.TENANT_DB_USER,
        password: process.env.TENANT_DB_PASS,
        database: dbName,
        entities: [User, Product],
        synchronize: true,
    });

    await dataSource.initialize();
    tenantConnections[dbName] = dataSource;
    console.log(`✅ Tenant DB connected: ${dbName}`);
    return dataSource;
}
