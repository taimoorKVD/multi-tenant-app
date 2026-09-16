import { In } from 'typeorm';
import { getTenantDataSource, MasterDataSource } from '../datasource';
import { ISeeder } from '../interfaces/seeder.interface';
import { Tenant } from '../../master/tenants/entities';
import { Vendor } from '../../tenants/vendors/entities';
import {
  mapDynamicPayloadToFieldIds,
  resolveModuleFormContext,
  resolveTenantActorId,
  upsertEntityDynamicData,
} from '../helpers/tenant-dynamic-seed';

/** Uses existing vendor default fields only: vendor_name, phone_number, email. */
type VendorSeed = {
  vendorName: string;
  email: string;
  phone: string;
};

const VENDOR_SEEDS: readonly VendorSeed[] = [
  {
    vendorName: 'Fresh Meat Suppliers',
    email: 'sales@freshmeat.com',
    phone: '0300-1234567',
  },
  {
    vendorName: 'Fresh Farm Vegetables',
    email: 'sales@freshfarm.com',
    phone: '0301-4567890',
  },
];

export class VendorsSeeder implements ISeeder {
  name = 'VendorsSeeder';

  async run() {
    const tenantRepo = MasterDataSource.getRepository(Tenant);
    const tenants = await tenantRepo.find();

    if (!tenants.length) {
      console.log('⚠️  No tenants found. Skipping vendors seeding.');
      return;
    }

    for (const tenant of tenants) {
      try {
        const tenantDataSource = await getTenantDataSource(tenant.dbName);
        const vendorRepo = tenantDataSource.getRepository(Vendor);
        const actorId = await resolveTenantActorId(tenantDataSource);
        const formContext = await resolveModuleFormContext(tenantDataSource, 'vendors');

        const existing = await vendorRepo.find({
          where: { vendorName: In(VENDOR_SEEDS.map((seed) => seed.vendorName)) },
          select: { id: true, vendorName: true },
        });
        const existingNames = new Set(existing.map((row) => row.vendorName));

        if (existingNames.size >= VENDOR_SEEDS.length) {
          console.log(`⚠️  Tenant "${tenant.subdomain}": vendors already seeded. Skipping.`);
          continue;
        }

        let inserted = 0;

        for (const seed of VENDOR_SEEDS) {
          if (existingNames.has(seed.vendorName)) continue;

          const vendor = await vendorRepo.save(
            vendorRepo.create({
              vendorName: seed.vendorName,
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );

          if (formContext) {
            const dynamicData = mapDynamicPayloadToFieldIds(formContext.fields, {
              email: seed.email,
              phone_number: seed.phone,
            });

            await upsertEntityDynamicData(tenantDataSource, {
              moduleId: formContext.moduleId,
              entityId: vendor.id,
              formVersionId: formContext.formVersionId,
              data: dynamicData,
              actorId,
            });
          }

          inserted += 1;
        }

        console.log(
          inserted
            ? `✅ Tenant "${tenant.subdomain}": seeded ${inserted} vendor(s).`
            : `⚠️  Tenant "${tenant.subdomain}": no new vendors inserted.`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to seed vendors for tenant "${tenant.subdomain}": ${(error as Error).message}`,
        );
      }
    }
  }
}
