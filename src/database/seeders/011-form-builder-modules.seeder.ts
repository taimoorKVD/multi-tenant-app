import { In } from 'typeorm';
import { getTenantDataSource, MasterDataSource } from '../datasource';
import { ISeeder } from '../interfaces/seeder.interface';
import { Tenant } from '../../master/tenants/entities';
import { DynamicModule } from '../../tenants/form-builder/entities';
import { User } from '../../tenants/users/entities';

type ModuleSeed = {
  slug: string;
  name: string;
};

export class FormBuilderModulesSeeder implements ISeeder {
  name = 'FormBuilderModulesSeeder';

  private readonly defaultModules: ModuleSeed[] = [
    { slug: 'users', name: 'Users' },
    { slug: 'items', name: 'Items' },
    { slug: 'vendors', name: 'Vendors' },
    { slug: 'job-positions', name: 'Job Positions' },
  ];

  private async resolveSystemActorId(tenantDataSource: any): Promise<number | null> {
    const userRepo = tenantDataSource.getRepository(User);

    const systemUser = await userRepo.findOne({
      where: { isSystem: true },
      order: { id: 'ASC' },
      select: { id: true },
    });

    if (systemUser?.id) {
      return systemUser.id;
    }

    const firstUser = await userRepo.findOne({
      order: { id: 'ASC' },
      select: { id: true },
    });

    return firstUser?.id ?? null;
  }

  async run() {
    const tenantRepo = MasterDataSource.getRepository(Tenant);
    const tenants = await tenantRepo.find();

    if (!tenants.length) {
      console.log('⚠️  No tenants found. Skipping form-builder module seeding.');
      return;
    }

    for (const tenant of tenants) {
      try {
        const tenantDataSource = await getTenantDataSource(tenant.dbName);
        const moduleRepo = tenantDataSource.getRepository(DynamicModule);
        const actorId = await this.resolveSystemActorId(tenantDataSource);
        const slugs = this.defaultModules.map((item) => item.slug);

        const existing = await moduleRepo.find({
          where: { slug: In(slugs) },
          withDeleted: true,
        });

        const existingBySlug = new Map(existing.map((item) => [item.slug, item]));
        let inserted = 0;
        let updated = 0;
        let restored = 0;

        for (const moduleSeed of this.defaultModules) {
          const current = existingBySlug.get(moduleSeed.slug);

          if (!current) {
            await moduleRepo.save(
              moduleRepo.create({
                slug: moduleSeed.slug,
                name: moduleSeed.name,
                isActive: true,
                createdBy: actorId,
                updatedBy: actorId,
              }),
            );
            inserted += 1;
            continue;
          }

          let changed = false;
          if (current.name !== moduleSeed.name) {
            current.name = moduleSeed.name;
            changed = true;
          }
          if (!current.isActive) {
            current.isActive = true;
            changed = true;
          }
          if (current.deletedAt) {
            current.deletedAt = null;
            changed = true;
            restored += 1;
          }
          if (actorId !== null && current.createdBy === null) {
            current.createdBy = actorId;
            changed = true;
          }
          if (actorId !== null && current.updatedBy === null) {
            current.updatedBy = actorId;
            changed = true;
          }

          if (changed) {
            if (actorId !== null) {
              current.updatedBy = actorId;
            }
            await moduleRepo.save(current);
            updated += 1;
          }
        }

        if (!inserted && !updated) {
          console.log(`⚠️  Form-builder modules already seeded for tenant "${tenant.subdomain}". Skipping.`);
          continue;
        }

        console.log(
          `✅ Tenant "${tenant.subdomain}": modules seeded (inserted=${inserted}, updated=${updated}, restored=${restored}).`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to seed form-builder modules for tenant "${tenant.subdomain}": ${(error as Error).message}`,
        );
      }
    }
  }
}
