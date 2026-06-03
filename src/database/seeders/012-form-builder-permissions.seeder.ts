import { getTenantDataSource, MasterDataSource } from '../datasource';
import { ISeeder } from '../interfaces/seeder.interface';
import { Tenant } from '../../master/tenants/entities';
import { Permission } from '../../tenants/permission/entities';
import { Role } from '../../tenants/role/entities';

export class FormBuilderPermissionsSeeder implements ISeeder {
  name = 'FormBuilderPermissionsSeeder';

  private readonly requiredPermissions = [
    'create-form',
    'view-form',
    'edit-form',
    'delete-form',
    'publish-form',
    'submit-form',
  ];

  async run() {
    const tenantRepo = MasterDataSource.getRepository(Tenant);
    const tenants = await tenantRepo.find();

    if (!tenants.length) {
      console.log('⚠️  No tenants found. Skipping form-builder permissions seeding.');
      return;
    }

    for (const tenant of tenants) {
      try {
        const tenantDataSource = await getTenantDataSource(tenant.dbName);
        const permissionRepo = tenantDataSource.getRepository(Permission);
        const roleRepo = tenantDataSource.getRepository(Role);

        // Keep serial sequence aligned with current data to avoid duplicate PK errors.
        await tenantDataSource.query(`
          SELECT setval(
            pg_get_serial_sequence('permissions', 'id'),
            COALESCE((SELECT MAX(id) FROM permissions), 0) + 1,
            false
          )
        `);

        const ensuredPermissions: Permission[] = [];
        let inserted = 0;

        for (const permissionName of this.requiredPermissions) {
          let permission = await permissionRepo.findOne({ where: { name: permissionName } });
          if (!permission) {
            permission = await permissionRepo.save(permissionRepo.create({ name: permissionName }));
            inserted += 1;
          }
          ensuredPermissions.push(permission);
        }

        const adminRole = await roleRepo.findOne({
          where: { name: 'Admin' },
          relations: ['permissions'],
        });

        if (!adminRole) {
          console.log(`⚠️  Tenant "${tenant.subdomain}" has no Admin role. Skipping role permission assignment.`);
          continue;
        }

        const existingNames = new Set((adminRole.permissions || []).map((permission) => permission.name));
        let granted = 0;

        for (const permission of ensuredPermissions) {
          if (!existingNames.has(permission.name)) {
            adminRole.permissions.push(permission);
            existingNames.add(permission.name);
            granted += 1;
          }
        }

        if (granted > 0) {
          await roleRepo.save(adminRole);
        }

        if (!inserted && !granted) {
          console.log(`⚠️  Tenant "${tenant.subdomain}": form-builder permissions already assigned to Admin.`);
          continue;
        }

        console.log(
          `✅ Tenant "${tenant.subdomain}": form-builder permissions ensured (created=${inserted}, assigned=${granted}).`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to seed form-builder permissions for tenant "${tenant.subdomain}": ${(error as Error).message}`,
        );
      }
    }
  }
}
