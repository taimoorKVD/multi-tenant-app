import { DataSource } from 'typeorm';
import { tenantDatabaseConfig } from '../../config/tenant-database.config';

export const tenantConnections: Record<string, DataSource> = {};

export async function getTenantDataSource(dbName: string): Promise<DataSource> {
  const existing = tenantConnections[dbName];
  if (existing?.isInitialized) {
    return existing;
  }

  const dataSource = new DataSource(tenantDatabaseConfig(dbName));
  await dataSource.initialize();

  // Retroactively mark any bootstrap admin users created before the isSystem column existed.
  // Safe to run on every fresh connection — only affects rows that are not yet flagged.
  try {
    await dataSource.query(`
      UPDATE users u
      SET is_system = true
      FROM roles r
      WHERE u.role_id = r.id
        AND r.name = 'Admin'
        AND u.email LIKE 'admin@%.com'
        AND u.is_system = false
    `);
  } catch {
    // Column may not exist yet on very first sync; TypeORM synchronize will add it on next init.
  }

  // Backfill permission.module for rows created before the column existed.
  try {
    await dataSource.query(`
      ALTER TABLE permissions
      ADD COLUMN IF NOT EXISTS module VARCHAR(100)
    `);
    await dataSource.query(`
      UPDATE permissions
      SET module = CASE
        WHEN name ~ '(^|-)dc-' THEN 'data-collection'
        WHEN name LIKE '%-form' OR name LIKE '%-form-%' THEN 'form-builder'
        WHEN name LIKE '%-reporting-category' OR name LIKE '%-reporting-group' THEN 'reporting-groups'
        WHEN name LIKE '%-job-position' THEN 'jobpositions'
        WHEN name LIKE '%-permission' THEN 'roles'
        WHEN name LIKE '%-role' THEN 'roles'
        WHEN name LIKE '%-user' THEN 'users'
        WHEN name LIKE '%-location' THEN 'locations'
        WHEN name LIKE '%-vendor' THEN 'vendors'
        WHEN name LIKE '%-item' THEN 'items'
        WHEN name LIKE '%-plan'
          OR name LIKE '%-subscription'
          OR name LIKE '%-invoice' THEN 'billing'
        WHEN name LIKE '%-tenant' THEN 'tenants'
        WHEN name LIKE '%-mail' OR name LIKE '%email-template%' THEN 'mail'
        ELSE 'general'
      END
      WHERE module IS NULL
    `);
  } catch {
    // Table may not exist yet on very first sync.
  }

  tenantConnections[dbName] = dataSource;
  console.log(`✅ Tenant DB connected: ${dbName}`);

  return dataSource;
}
