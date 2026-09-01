import { In } from 'typeorm';
import { getTenantDataSource, MasterDataSource } from '../datasource';
import { ISeeder } from '../interfaces/seeder.interface';
import { Tenant } from '../../master/tenants/entities';
import {
  DataCollectionTemplate,
  TemplateStatus,
  TemplateVersion,
} from '../../tenants/data-collection/entities';
import { JobPosition } from '../../tenants/job-positions/entities';
import { User } from '../../tenants/users/entities';
import {
  RESTAURANT_DC_TEMPLATE_SEED_NAMES,
  RESTAURANT_DC_TEMPLATE_SEEDS,
  buildRestaurantTemplateSchema,
} from '../../tenants/data-collection/config/restaurant-template-seeds';

export class DataCollectionRestaurantTemplatesSeeder implements ISeeder {
  name = 'DataCollectionRestaurantTemplatesSeeder';

  private todayUtcDateOnly(): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private async resolveActorId(tenantDataSource: Awaited<ReturnType<typeof getTenantDataSource>>): Promise<number | null> {
    const userRepo = tenantDataSource.getRepository(User);

    const systemUser = await userRepo.findOne({
      where: { isSystem: true },
      order: { id: 'ASC' },
      select: { id: true },
    });
    if (systemUser?.id) return systemUser.id;

    const adminUser = await userRepo
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('role.name = :roleName', { roleName: 'Admin' })
      .orderBy('user.id', 'ASC')
      .select(['user.id'])
      .getOne();
    if (adminUser?.id) return adminUser.id;

    const firstUser = await userRepo.findOne({
      order: { id: 'ASC' },
      select: { id: true },
    });
    return firstUser?.id ?? null;
  }

  private async resolveJobPositionIds(
    tenantDataSource: Awaited<ReturnType<typeof getTenantDataSource>>,
    names: string[],
  ): Promise<number[]> {
    if (!names.length) return [];

    const jobPositionRepo = tenantDataSource.getRepository(JobPosition);
    const rows = await jobPositionRepo.find({
      where: { name: In(names) },
      select: { id: true, name: true },
    });

    const byName = new Map(rows.map((row) => [row.name, row.id]));
    const ids: number[] = [];
    for (const name of names) {
      const id = byName.get(name);
      if (id !== undefined) ids.push(id);
    }
    return ids;
  }

  async run() {
    const tenantRepo = MasterDataSource.getRepository(Tenant);
    const tenants = await tenantRepo.find();

    if (!tenants.length) {
      console.log('⚠️  No tenants found. Skipping restaurant data-collection template seeding.');
      return;
    }

    const startDate = this.todayUtcDateOnly();

    for (const tenant of tenants) {
      try {
        const tenantDataSource = await getTenantDataSource(tenant.dbName);
        const templateRepo = tenantDataSource.getRepository(DataCollectionTemplate);
        const versionRepo = tenantDataSource.getRepository(TemplateVersion);

        const existing = await templateRepo.find({
          where: { name: In([...RESTAURANT_DC_TEMPLATE_SEED_NAMES]) },
          select: { id: true, name: true },
        });

        if (existing.length >= RESTAURANT_DC_TEMPLATE_SEED_NAMES.length) {
          console.log(
            `⚠️  Tenant "${tenant.subdomain}": restaurant data-collection templates already seeded. Skipping.`,
          );
          continue;
        }

        const existingNames = new Set(existing.map((item) => item.name));
        const actorId = await this.resolveActorId(tenantDataSource);

        let inserted = 0;

        for (const seed of RESTAURANT_DC_TEMPLATE_SEEDS) {
          if (existingNames.has(seed.name)) continue;

          const assignJobPositionIds = await this.resolveJobPositionIds(
            tenantDataSource,
            seed.assignJobPositions,
          );
          const reportJobPositionIds = await this.resolveJobPositionIds(
            tenantDataSource,
            seed.reportJobPositions,
          );

          const assignUserIds = assignJobPositionIds.length ? [] : actorId ? [actorId] : [];
          const reportUserIds = reportJobPositionIds.length ? [] : actorId ? [actorId] : [];

          const schema = buildRestaurantTemplateSchema(seed, {
            assignJobPositionIds,
            reportJobPositionIds,
            assignUserIds,
            reportUserIds,
            startDate,
          });

          const template = await templateRepo.save(
            templateRepo.create({
              name: seed.name,
              schema,
              status: TemplateStatus.ACTIVE,
              isActive: true,
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );

          await versionRepo.save(
            versionRepo.create({
              templateId: template.id,
              versionNumber: 1,
              schemaSnapshot: schema,
              isActive: true,
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );

          inserted += 1;
        }

        if (!inserted) {
          console.log(
            `⚠️  Tenant "${tenant.subdomain}": no new restaurant data-collection templates inserted.`,
          );
          continue;
        }

        console.log(
          `✅ Tenant "${tenant.subdomain}": seeded ${inserted} restaurant data-collection template(s).`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to seed restaurant data-collection templates for tenant "${tenant.subdomain}": ${(error as Error).message}`,
        );
      }
    }
  }
}
