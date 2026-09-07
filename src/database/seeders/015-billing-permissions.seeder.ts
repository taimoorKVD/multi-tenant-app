import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';
import { Permission } from '../../master/permission/entities';
import { Role } from '../../master/role/entities';
import { resolvePermissionModuleName } from '../../common/utils/permission-module';

export class BillingPermissionsSeeder implements ISeeder {
  name = 'BillingPermissionsSeeder';

  private readonly requiredPermissions = [
    'create-plan',
    'view-plan',
    'edit-plan',
    'delete-plan',
    'create-subscription',
    'view-subscription',
    'edit-subscription',
    'delete-subscription',
    'view-invoice',
    'edit-invoice',
  ];

  async run() {
    const permissionRepo = MasterDataSource.getRepository(Permission);
    const roleRepo = MasterDataSource.getRepository(Role);

    const ensured: Permission[] = [];
    let inserted = 0;
    for (const name of this.requiredPermissions) {
      let permission = await permissionRepo.findOne({ where: { name } });
      if (!permission) {
        permission = await permissionRepo.save(
          permissionRepo.create({
            name,
            module: resolvePermissionModuleName(name),
          } as Permission),
        );
        inserted += 1;
      } else if (!permission.module) {
        permission.module = resolvePermissionModuleName(name);
        await permissionRepo.save(permission);
      }
      ensured.push(permission);
    }

    const superAdmin = await roleRepo.findOne({
      where: { name: 'Super Admin' },
      relations: ['permissions'],
    });
    if (superAdmin) {
      const existing = new Set((superAdmin.permissions || []).map((p) => p.name));
      let granted = 0;
      for (const permission of ensured) {
        if (!existing.has(permission.name)) {
          superAdmin.permissions.push(permission);
          existing.add(permission.name);
          granted += 1;
        }
      }
      if (granted > 0) await roleRepo.save(superAdmin);
      console.log(
        `✅ Billing permissions: inserted ${inserted}, granted ${granted} to Super Admin.`,
      );
    } else {
      console.log(`✅ Billing permissions: inserted ${inserted}. Super Admin role not found.`);
    }
  }
}
