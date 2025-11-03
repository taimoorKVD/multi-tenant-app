import { DataSource } from 'typeorm';
import { tenantDatabaseConfig } from '../../config/tenant-database.config';

export const tenantConnections: Record<string, DataSource> = {};

export async function getTenantDataSource(dbName: string): Promise<DataSource> {
  if (tenantConnections[dbName]) {
    return tenantConnections[dbName];
  }

  const dataSource = new DataSource(tenantDatabaseConfig(dbName));
  await dataSource.initialize();

  tenantConnections[dbName] = dataSource;
  console.log(`✅ Tenant DB connected: ${dbName}`);

  return dataSource;
}
