import { getTenantDataSource, MasterDataSource } from '../datasource';
import { ISeeder } from '../interfaces/seeder.interface';
import { Tenant } from '../../master/tenants/entities';
import { Permission } from '../../tenants/permission/entities';
import { Role } from '../../tenants/role/entities';
import { In } from 'typeorm';

/**
 * Form-builder APIs are built into every module (users, items, vendors, …)
 * and no longer use RBAC. This seeder detaches legacy form permissions from roles.
 */
export class FormBuilderPermissionsSeeder implements ISeeder {
  name = 'FormBuilderPermissionsSeeder';

  private readonly legacyFormPermissions = [
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
      console.log('⚠️  No tenants found. Skipping form-builder permissions cleanup.');
      return;
    }

    for (const tenant of tenants) {
      try {
        const tenantDataSource = await getTenantDataSource(tenant.dbName);
        const permissionRepo = tenantDataSource.getRepository(Permission);
        const roleRepo = tenantDataSource.getRepository(Role);

        const legacyPermissions = await permissionRepo.find({
          where: { name: In(this.legacyFormPermissions) },
        });
        if (!legacyPermissions.length) {
          console.log(`⚠️  Tenant "${tenant.subdomain}": no legacy form-builder permissions.`);
          continue;
        }

        const legacyIds = new Set(legacyPermissions.map((permission) => permission.id));
        const roles = await roleRepo.find({ relations: ['permissions'] });
        let detached = 0;

        for (const role of roles) {
          const before = role.permissions?.length || 0;
          role.permissions = (role.permissions || []).filter(
            (permission) => !legacyIds.has(permission.id),
          );
          const removed = before - role.permissions.length;
          if (removed > 0) {
            await roleRepo.save(role);
            detached += removed;
          }
        }

        console.log(
          `✅ Tenant "${tenant.subdomain}": detached ${detached} legacy form-builder permission link(s) from roles.`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to clean form-builder permissions for tenant "${tenant.subdomain}": ${(error as Error).message}`,
        );
      }
    }
  }
}
