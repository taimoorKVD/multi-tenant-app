import { In } from 'typeorm';
import { getTenantDataSource, MasterDataSource } from '../datasource';
import { ISeeder } from '../interfaces/seeder.interface';
import { Tenant } from '../../master/tenants/entities';
import { Item } from '../../tenants/items/entities';
import { Vendor } from '../../tenants/vendors/entities';
import {
  mapDynamicPayloadToFieldIds,
  resolveModuleFormContext,
  resolveTenantActorId,
  upsertEntityDynamicData,
} from '../helpers/tenant-dynamic-seed';

/** Uses existing item default fields only: item_name, item_no, size, par, vendor_id. */
type ItemSeed = {
  itemName: string;
  itemNo: string;
  size: string;
  par: number;
  vendorName: string;
};

const ITEM_SEEDS: readonly ItemSeed[] = [
  {
    itemName: 'Chicken Breast',
    itemNo: 'MEAT-001',
    size: 'KG',
    par: 20,
    vendorName: 'Fresh Meat Suppliers',
  },
  {
    itemName: 'Beef',
    itemNo: 'MEAT-002',
    size: 'KG',
    par: 15,
    vendorName: 'Fresh Meat Suppliers',
  },
  {
    itemName: 'Potato',
    itemNo: 'VEG-001',
    size: 'KG',
    par: 20,
    vendorName: 'Fresh Farm Vegetables',
  },
  {
    itemName: 'Onion',
    itemNo: 'VEG-002',
    size: 'KG',
    par: 15,
    vendorName: 'Fresh Farm Vegetables',
  },
  {
    itemName: 'Tomato',
    itemNo: 'VEG-003',
    size: 'KG',
    par: 15,
    vendorName: 'Fresh Farm Vegetables',
  },
  {
    itemName: 'Carrot',
    itemNo: 'VEG-004',
    size: 'KG',
    par: 10,
    vendorName: 'Fresh Farm Vegetables',
  },
];

export class ItemsSeeder implements ISeeder {
  name = 'ItemsSeeder';

  async run() {
    const tenantRepo = MasterDataSource.getRepository(Tenant);
    const tenants = await tenantRepo.find();

    if (!tenants.length) {
      console.log('⚠️  No tenants found. Skipping items seeding.');
      return;
    }

    for (const tenant of tenants) {
      try {
        const tenantDataSource = await getTenantDataSource(tenant.dbName);
        const itemRepo = tenantDataSource.getRepository(Item);
        const vendorRepo = tenantDataSource.getRepository(Vendor);
        const actorId = await resolveTenantActorId(tenantDataSource);
        const formContext = await resolveModuleFormContext(tenantDataSource, 'items');

        const existing = await itemRepo.find({
          where: { itemName: In(ITEM_SEEDS.map((seed) => seed.itemName)) },
          select: { id: true, itemName: true },
        });
        const existingNames = new Set(existing.map((row) => row.itemName));

        if (existingNames.size >= ITEM_SEEDS.length) {
          console.log(`⚠️  Tenant "${tenant.subdomain}": items already seeded. Skipping.`);
          continue;
        }

        const vendors = await vendorRepo.find({
          where: {
            vendorName: In([...new Set(ITEM_SEEDS.map((seed) => seed.vendorName))]),
          },
          select: { id: true, vendorName: true },
        });
        const vendorIdByName = new Map(vendors.map((vendor) => [vendor.vendorName, vendor.id]));

        let inserted = 0;

        for (const seed of ITEM_SEEDS) {
          if (existingNames.has(seed.itemName)) continue;

          const vendorId = vendorIdByName.get(seed.vendorName);
          if (!vendorId) {
            console.log(
              `⚠️  Tenant "${tenant.subdomain}": vendor "${seed.vendorName}" missing for item "${seed.itemName}". Skipping item.`,
            );
            continue;
          }

          const item = await itemRepo.save(
            itemRepo.create({
              itemName: seed.itemName,
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );

          if (formContext) {
            // Store the vendor primary key so Item "Select Vendor" binds to valueKey: 'id'.
            const dynamicData = mapDynamicPayloadToFieldIds(formContext.fields, {
              item_no: seed.itemNo,
              size: seed.size,
              par: seed.par,
              vendor_id: Number(vendorId),
            });

            await upsertEntityDynamicData(tenantDataSource, {
              moduleId: formContext.moduleId,
              entityId: item.id,
              formVersionId: formContext.formVersionId,
              data: dynamicData,
              actorId,
            });
          }

          inserted += 1;
        }

        console.log(
          inserted
            ? `✅ Tenant "${tenant.subdomain}": seeded ${inserted} item(s).`
            : `⚠️  Tenant "${tenant.subdomain}": no new items inserted.`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to seed items for tenant "${tenant.subdomain}": ${(error as Error).message}`,
        );
      }
    }
  }
}
