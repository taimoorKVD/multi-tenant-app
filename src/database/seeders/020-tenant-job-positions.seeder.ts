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
};

/** Permission names aligned with tenant Admin role (019-tenant.seeder). */
const ADMIN_PERMISSION_NAMES = [
  'create-user',
  'edit-user',
  'view-user',
  'delete-user',
  'create-role',
  'edit-role',
  'view-role',
  'delete-role',
  'create-job-position',
  'edit-job-position',
  'view-job-position',
  'delete-job-position',
  'create-location',
  'edit-location',
  'view-location',
  'delete-location',
  'create-vendor',
  'edit-vendor',
  'view-vendor',
  'delete-vendor',
  'create-reporting-group',
  'edit-reporting-group',
  'view-reporting-group',
  'delete-reporting-group',
  'create-item',
  'edit-item',
  'view-item',
  'delete-item',
  'create-permission',
  'edit-permission',
  'view-permission',
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

const JOB_POSITION_SEEDS: readonly JobPositionSeed[] = [
  {
    name: 'General Manager',
    department: 'Management',
    role: 'Admin',
  },
  {
    name: 'Kitchen Manager',
    department: 'Kitchen',
    role: 'Employee',
  },
  {
    name: 'Kitchen Staff',
    department: 'Kitchen',
    role: 'Employee',
  },
];

export class TenantJobPositionsSeeder implements ISeeder {
  name = 'TenantJobPositionsSeeder';

  private permissionNamesForRole(role: JobPositionSeed['role']): readonly string[] {
    return role === 'Admin' ? ADMIN_PERMISSION_NAMES : EMPLOYEE_PERMISSION_NAMES;
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

        const existing = await jobPositionRepo.find({
          where: { name: In(JOB_POSITION_SEEDS.map((seed) => seed.name)) },
          select: { id: true, name: true },
        });
        const existingNames = new Set(existing.map((row) => row.name));

        if (existingNames.size >= JOB_POSITION_SEEDS.length) {
          console.log(
            `⚠️  Tenant "${tenant.subdomain}": sample job positions already seeded. Skipping.`,
          );
          continue;
        }

        const allPermissionNames = [
          ...new Set(JOB_POSITION_SEEDS.flatMap((seed) => this.permissionNamesForRole(seed.role))),
        ];
        const permissions = await permissionRepo.find({
          where: { name: In(allPermissionNames) },
        });
        const permissionByName = new Map(permissions.map((permission) => [permission.name, permission]));

        let inserted = 0;

        for (const seed of JOB_POSITION_SEEDS) {
          if (existingNames.has(seed.name)) continue;

          const permissionNames = this.permissionNamesForRole(seed.role);
          const assignedPermissions = permissionNames
            .map((name) => permissionByName.get(name))
            .filter((permission): permission is Permission => Boolean(permission));

          await jobPositionRepo.save(
            jobPositionRepo.create({
              name: seed.name,
              description: `Department: ${seed.department} | Role: ${seed.role}`,
              permissions: assignedPermissions,
            }),
          );

          inserted += 1;
        }

        console.log(
          inserted
            ? `✅ Tenant "${tenant.subdomain}": seeded ${inserted} job position(s).`
            : `⚠️  Tenant "${tenant.subdomain}": no new job positions inserted.`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to seed job positions for tenant "${tenant.subdomain}": ${(error as Error).message}`,
        );
      }
    }
  }
}
