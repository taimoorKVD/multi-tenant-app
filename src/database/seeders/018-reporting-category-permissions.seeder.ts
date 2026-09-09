import { In } from 'typeorm';
import { getTenantDataSource, MasterDataSource } from '../datasource';
import { ISeeder } from '../interfaces/seeder.interface';
import { Tenant } from '../../master/tenants/entities';
import { Permission as MasterPermission } from '../../master/permission/entities';
import { Role as MasterRole } from '../../master/role/entities';
import { Permission as TenantPermission } from '../../tenants/permission/entities';
import { Role as TenantRole } from '../../tenants/role/entities';

/**
 * Reporting categories live under reporting groups, so standalone
 * reporting-category RBAC permissions are removed.
 */
export class ReportingCategoryPermissionsSeeder implements ISeeder {
  name = 'ReportingCategoryPermissionsSeeder';

  private readonly legacyPermissions = [
    'create-reporting-category',
    'view-reporting-category',
    'edit-reporting-category',
    'delete-reporting-category',
  ];

  async run() {
    await this.cleanupMaster();
    await this.cleanupTenants();
  }

  private async cleanupMaster() {
    const permissionRepo = MasterDataSource.getRepository(MasterPermission);
    const roleRepo = MasterDataSource.getRepository(MasterRole);

    const legacyPermissions = await permissionRepo.find({
      where: { name: In(this.legacyPermissions) },
    });
    if (!legacyPermissions.length) {
      console.log('ℹ️  Master: no legacy reporting-category permissions.');
      return;
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

    await permissionRepo.remove(legacyPermissions);
    console.log(
      `✅ Master: detached ${detached} reporting-category permission link(s) and deleted ${legacyPermissions.length} permission(s).`,
    );
  }

  private async cleanupTenants() {
    const tenantRepo = MasterDataSource.getRepository(Tenant);
    const tenants = await tenantRepo.find();

    if (!tenants.length) {
      console.log('⚠️  No tenants found. Skipping reporting-category permissions cleanup.');
      return;
    }

    for (const tenant of tenants) {
      try {
        const tenantDataSource = await getTenantDataSource(tenant.dbName);
        const permissionRepo = tenantDataSource.getRepository(TenantPermission);
        const roleRepo = tenantDataSource.getRepository(TenantRole);

        const legacyPermissions = await permissionRepo.find({
          where: { name: In(this.legacyPermissions) },
        });
        if (!legacyPermissions.length) {
          console.log(`ℹ️  Tenant "${tenant.subdomain}": no legacy reporting-category permissions.`);
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

        await permissionRepo.remove(legacyPermissions);
        console.log(
          `✅ Tenant "${tenant.subdomain}": detached ${detached} reporting-category permission link(s) and deleted ${legacyPermissions.length} permission(s).`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to clean reporting-category permissions for tenant "${tenant.subdomain}": ${(error as Error).message}`,
        );
      }
    }
  }
}
