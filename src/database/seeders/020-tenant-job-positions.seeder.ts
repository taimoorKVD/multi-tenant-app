import { In } from 'typeorm';
import { getTenantDataSource, MasterDataSource } from '../datasource';
import { ISeeder } from '../interfaces/seeder.interface';
import { Tenant } from '../../master/tenants/entities';
import { JobPosition } from '../../tenants/job-positions/entities';
import { Permission } from '../../tenants/permission/entities';

type JobPositionSeed = {
  name: string;
  department: string;
  role: 'Admin' | 'Employee';
  permissionNames: readonly string[];
};

/** Permission names aligned with tenant Admin role (019-tenant.seeder). */
const ADMIN_PERMISSION_NAMES = [
  'create-user',
  'view-user',
  'edit-user',
  'delete-user',
  'create-role',
  'view-role',
  'edit-role',
  'delete-role',
  'create-job-position',
  'view-job-position',
  'edit-job-position',
  'delete-job-position',
  'create-location',
  'view-location',
  'edit-location',
  'delete-location',
  'create-vendor',
  'view-vendor',
  'edit-vendor',
  'delete-vendor',
  'create-reporting-group',
  'view-reporting-group',
  'edit-reporting-group',
  'delete-reporting-group',
  'create-item',
  'view-item',
  'edit-item',
  'delete-item',
  'create-permission',
  'view-permission',
  'edit-permission',
  'delete-permission',
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
] as const;

/** Permission names aligned with tenant Employee role (019-tenant.seeder). */
const EMPLOYEE_PERMISSION_NAMES = [
  'view-dc-assignment',
  'complete-dc-assignment',
  'view-dc-template',
  'view-item',
  'view-location',
  'view-job-position',
] as const;

/** Kitchen Manager: Employee base + view access for core modules + Task Review. */
const KITCHEN_MANAGER_PERMISSION_NAMES = [
  ...EMPLOYEE_PERMISSION_NAMES,
  'view-user',
  'view-vendor',
  'view-item',
  'view-job-position',
  'view-location',
  'view-reporting-group',
  'review-dc-submission',
] as const;

const JOB_POSITION_SEEDS: readonly JobPositionSeed[] = [
  {
    name: 'General Manager',
    department: 'Management',
    role: 'Admin',
    permissionNames: ADMIN_PERMISSION_NAMES,
  },
  {
    name: 'Kitchen Manager',
    department: 'Kitchen',
    role: 'Employee',
    permissionNames: KITCHEN_MANAGER_PERMISSION_NAMES,
  },
  {
    name: 'Kitchen Staff',
    department: 'Kitchen',
    role: 'Employee',
    permissionNames: EMPLOYEE_PERMISSION_NAMES,
  },
];

export class TenantJobPositionsSeeder implements ISeeder {
  name = 'TenantJobPositionsSeeder';

  private resolvePermissions(
    permissionByName: Map<string, Permission>,
    permissionNames: readonly string[],
  ): Permission[] {
    const uniqueNames = [...new Set(permissionNames)];
    return uniqueNames
      .map((name) => permissionByName.get(name))
      .filter((permission): permission is Permission => Boolean(permission));
  }

  async run() {
    const tenantRepo = MasterDataSource.getRepository(Tenant);
    const tenants = await tenantRepo.find();

    if (!tenants.length) {
      console.log('⚠️  No tenants found. Skipping tenant job-positions seeding.');
      return;
    }

    for (const tenant of tenants) {
      try {
        const tenantDataSource = await getTenantDataSource(tenant.dbName);
        const jobPositionRepo = tenantDataSource.getRepository(JobPosition);
        const permissionRepo = tenantDataSource.getRepository(Permission);

        const allPermissionNames = [
          ...new Set(JOB_POSITION_SEEDS.flatMap((seed) => seed.permissionNames)),
        ];
        const permissions = await permissionRepo.find({
          where: { name: In(allPermissionNames) },
        });
        const permissionByName = new Map(permissions.map((permission) => [permission.name, permission]));

        const existing = await jobPositionRepo.find({
          where: { name: In(JOB_POSITION_SEEDS.map((seed) => seed.name)) },
          relations: ['permissions'],
        });
        const existingByName = new Map(existing.map((row) => [row.name, row]));

        let inserted = 0;
        let updated = 0;

        for (const seed of JOB_POSITION_SEEDS) {
          const assignedPermissions = this.resolvePermissions(
            permissionByName,
            seed.permissionNames,
          );
          const description = `Department: ${seed.department} | Role: ${seed.role}`;
          const current = existingByName.get(seed.name);

          if (!current) {
            await jobPositionRepo.save(
              jobPositionRepo.create({
                name: seed.name,
                description,
                permissions: assignedPermissions,
              }),
            );
            inserted += 1;
            continue;
          }

          // Keep Kitchen Manager (and others) in sync when permission sets change.
          current.description = description;
          current.permissions = assignedPermissions;
          await jobPositionRepo.save(current);
          updated += 1;
        }

        const parts: string[] = [];
        if (inserted) parts.push(`seeded ${inserted}`);
        if (updated) parts.push(`updated ${updated}`);
        console.log(
          parts.length
            ? `✅ Tenant "${tenant.subdomain}": ${parts.join(', ')} job position(s).`
            : `⚠️  Tenant "${tenant.subdomain}": no job position changes.`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to seed job positions for tenant "${tenant.subdomain}": ${(error as Error).message}`,
        );
      }
    }
  }
}
