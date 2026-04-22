import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';
import { Permission } from '../../master/permission/entities';

export class PermissionSeeder implements ISeeder {
  name = 'PermissionSeeder';

  async run() {
    const repo = MasterDataSource.getRepository(Permission);
    const existing = await repo.count();
    if (existing > 0) return;

    const modules = [
      {
        module: 'user',
        actions: ['create', 'view', 'edit', 'delete'],
        description: 'User management permissions',
      },
      {
        module: 'role',
        actions: ['create', 'view', 'edit', 'delete'],
        description: 'Role management permissions',
      },
      {
        module: 'permission',
        actions: ['create', 'view', 'edit', 'delete'],
        description: 'Permission management permissions',
      },
      {
        module: 'tenant',
        actions: ['create', 'view', 'edit', 'delete'],
        description: 'Tenant management permissions',
      },
      {
        module: 'jobposition',
        actions: ['create', 'view', 'edit', 'delete'],
        description: 'Job position management permissions',
      },
      {
        module: 'location',
        actions: ['create', 'view', 'edit', 'delete'],
        description: 'Location management permissions',
      },
      {
        module: 'vendor',
        actions: ['create', 'view', 'edit', 'delete'],
        description: 'Vendor management permissions',
      },
    ];

    const allPermissions = modules.flatMap((mod) =>
      mod.actions.map((action) => ({
        name: `${action}-${mod.module}`,
        description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${mod.module}`,
      })),
    );

    await repo.save(allPermissions);

    console.log(`✅ Seeded ${allPermissions.length} permissions.`);
  }
}
