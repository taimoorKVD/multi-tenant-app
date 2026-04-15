import {ISeeder} from '../interfaces/seeder.interface';
import {MasterDataSource, getTenantDataSource} from '../datasource';
import {Tenant} from '../../master/tenants/entities';
import {Location} from '../../tenants/locations/entities';

export class LocationSeeder implements ISeeder {
  name = 'LocationSeeder';

  async run() {
    const tenantRepo = MasterDataSource.getRepository(Tenant);
    const tenants = await tenantRepo.find();

    if (!tenants.length) {
      console.log('⚠️  No tenants found. Skipping location seeding.');
      return;
    }

    const defaultLocations: Partial<Location>[] = [
      {
        name: 'Head Office',
        address: '100 Main Street',
        city: 'New York',
        country: 'USA',
        postalCode: '10001',
      },
      {
        name: 'Downtown Branch',
        address: '250 Broadway Ave',
        city: 'New York',
        country: 'USA',
        postalCode: '10007',
      },
      {
        name: 'Warehouse',
        address: '80 Logistics Park',
        city: 'Jersey City',
        country: 'USA',
        postalCode: '07302',
      },
    ];

    for (const tenant of tenants) {
      try {
        const tenantDataSource = await getTenantDataSource(tenant.dbName);
        const locationRepo = tenantDataSource.getRepository(Location);
        const existing = await locationRepo.count();

        if (existing > 0) {
          console.log(`⚠️  Locations already exist for tenant "${tenant.subdomain}". Skipping.`);
          continue;
        }

        await locationRepo.save(locationRepo.create(defaultLocations as Location[]));
        console.log(`✅ Seeded ${defaultLocations.length} locations for tenant "${tenant.subdomain}".`);
      } catch (error) {
        console.error(
          `❌ Failed to seed locations for tenant "${tenant.subdomain}": ${error.message}`,
        );
      }
    }
  }
}
