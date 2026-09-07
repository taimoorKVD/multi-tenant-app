import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';
import { Permission } from '../../master/permission/entities';
import { resolvePermissionModuleName } from '../../common/utils/permission-module';

export class PermissionSeeder implements ISeeder {
  name = 'PermissionSeeder';

  async run() {
    const repo = MasterDataSource.getRepository(Permission);
    const existing = await repo.count();
    if (existing > 0) {
      const missingModule = await repo
        .createQueryBuilder('permission')
        .where('permission.module IS NULL')
        .getMany();
      if (missingModule.length) {
        for (const permission of missingModule) {
          permission.module = resolvePermissionModuleName(permission.name);
        }
        await repo.save(missingModule);
        console.log(`✅ Backfilled module on ${missingModule.length} permissions.`);
      }
      return;
    }

    const modules = [
      {
        module: 'users',
        permissionModule: 'user',
        actions: ['create', 'view', 'edit', 'delete'],
      },
      {
        module: 'roles',
        permissionModule: 'role',
        actions: ['create', 'view', 'edit', 'delete'],
      },
      {
        module: 'roles',
        permissionModule: 'permission',
        actions: ['create', 'view', 'edit', 'delete'],
      },
      {
        module: 'tenants',
        permissionModule: 'tenant',
        actions: ['create', 'view', 'edit', 'delete'],
      },
      {
        module: 'jobpositions',
        permissionModule: 'job-position',
        actions: ['create', 'view', 'edit', 'delete'],
      },
      {
        module: 'locations',
        permissionModule: 'location',
        actions: ['create', 'view', 'edit', 'delete'],
      },
      {
        module: 'vendors',
        permissionModule: 'vendor',
        actions: ['create', 'view', 'edit', 'delete'],
      },
      {
        module: 'reporting-groups',
        permissionModule: 'reporting-group',
        actions: ['create', 'view', 'edit', 'delete'],
      },
      {
        module: 'reporting-categories',
        permissionModule: 'reporting-category',
        actions: ['create', 'view', 'edit', 'delete'],
      },
      {
        module: 'items',
        permissionModule: 'item',
        actions: ['create', 'view', 'edit', 'delete'],
      },
    ];

    const allPermissions = modules.flatMap((mod) =>
      mod.actions.map((action) => ({
        name: `${action}-${mod.permissionModule}`,
        module: mod.module,
      })),
    );

    await repo.save(allPermissions);

    console.log(`✅ Seeded ${allPermissions.length} permissions.`);
  }
}
