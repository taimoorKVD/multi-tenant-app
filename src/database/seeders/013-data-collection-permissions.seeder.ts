import { getTenantDataSource, MasterDataSource } from '../datasource';
import { ISeeder } from '../interfaces/seeder.interface';
import { Tenant } from '../../master/tenants/entities';
import { Permission } from '../../tenants/permission/entities';
import { Role } from '../../tenants/role/entities';
import { resolvePermissionModuleName } from '../../common/utils/permission-module';

export class DataCollectionPermissionsSeeder implements ISeeder {
  name = 'DataCollectionPermissionsSeeder';

  private readonly requiredPermissions = [
    'create-dc-template',
    'view-dc-template',
    'edit-dc-template',
    'delete-dc-template',
    'activate-dc-template',
    'archive-dc-template',
    'view-dc-assignment',
    'complete-dc-assignment',
    'view-dc-submission',
    'review-dc-submission',
  ];

  async run() {
    const tenantRepo = MasterDataSource.getRepository(Tenant);
    const tenants = await tenantRepo.find();

    if (!tenants.length) {
      console.log('⚠️  No tenants found. Skipping data-collection permissions seeding.');
      return;
    }

    for (const tenant of tenants) {
      try {
        const tenantDataSource = await getTenantDataSource(tenant.dbName);
        const permissionRepo = tenantDataSource.getRepository(Permission);
        const roleRepo = tenantDataSource.getRepository(Role);

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
            permission = await permissionRepo.save(
              permissionRepo.create({
                name: permissionName,
                module: resolvePermissionModuleName(permissionName),
              }),
            );
            inserted += 1;
          } else if (!permission.module) {
            permission.module = resolvePermissionModuleName(permissionName);
            await permissionRepo.save(permission);
          }
          ensuredPermissions.push(permission);
        }

        const adminRole = await roleRepo.findOne({
          where: { name: 'Admin' },
          relations: ['permissions'],
        });

        if (!adminRole) {
          console.log(`⚠️  Tenant "${tenant.subdomain}" has no Admin role. Skipping.`);
          continue;
        }

        const existingNames = new Set((adminRole.permissions || []).map((p) => p.name));
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

        const employeePermissionNames = [
          'view-dc-assignment',
          'complete-dc-assignment',
          'view-dc-template',
          'submit-form',
          'view-item',
          'view-location',
          'view-job-position',
        ];

        const employeePermissions: Permission[] = [];
        for (const permissionName of employeePermissionNames) {
          let permission = await permissionRepo.findOne({ where: { name: permissionName } });
          if (!permission) {
            permission = await permissionRepo.save(
              permissionRepo.create({
                name: permissionName,
                module: resolvePermissionModuleName(permissionName),
              }),
            );
            inserted += 1;
          } else if (!permission.module) {
            permission.module = resolvePermissionModuleName(permissionName);
            await permissionRepo.save(permission);
          }
          employeePermissions.push(permission);
        }

        let employeeRole = await roleRepo.findOne({
          where: { name: 'Employee' },
          relations: ['permissions'],
        });

        let employeeGranted = 0;
        if (!employeeRole) {
          employeeRole = roleRepo.create({
            name: 'Employee',
            permissions: employeePermissions,
          });
          await roleRepo.save(employeeRole);
          employeeGranted = employeePermissions.length;
          console.log(`✅ Tenant "${tenant.subdomain}": Employee role created.`);
        } else {
          const employeeExisting = new Set((employeeRole.permissions || []).map((p) => p.name));
          for (const permission of employeePermissions) {
            if (!employeeExisting.has(permission.name)) {
              employeeRole.permissions = [...(employeeRole.permissions || []), permission];
              employeeExisting.add(permission.name);
              employeeGranted += 1;
            }
          }
          if (employeeGranted > 0) {
            await roleRepo.save(employeeRole);
          }
        }

        if (!inserted && !granted && !employeeGranted) {
          console.log(`⚠️  Tenant "${tenant.subdomain}": data-collection permissions already assigned.`);
          continue;
        }

        console.log(
          `✅ Tenant "${tenant.subdomain}": data-collection permissions ensured (created=${inserted}, adminAssigned=${granted}, employeeAssigned=${employeeGranted}).`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to seed data-collection permissions for tenant "${tenant.subdomain}": ${(error as Error).message}`,
        );
      }
    }
  }
}
