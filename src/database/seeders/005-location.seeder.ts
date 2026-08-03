import {ISeeder} from '../interfaces/seeder.interface';
import {MasterDataSource, getTenantDataSource} from '../datasource';
import {Tenant} from '../../master/tenants/entities';
import {Country} from '../../master/countries/entities';
import {State} from '../../master/states/entities';
import {City} from '../../master/cities/entities';
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

    const countryRepo = MasterDataSource.getRepository(Country);
    const stateRepo = MasterDataSource.getRepository(State);
    const cityRepo = MasterDataSource.getRepository(City);

    const usCountry = await countryRepo.findOne({where: {code: 'US'}});
    const nyState = usCountry
      ? await stateRepo.findOne({where: {countryId: usCountry.id, name: 'New York'}})
      : null;
    const njState = usCountry
      ? await stateRepo.findOne({where: {countryId: usCountry.id, name: 'New Jersey'}})
      : null;
    const nycCity = nyState
      ? await cityRepo.findOne({where: {stateId: nyState.id, name: 'New York City'}})
      : null;
    const jerseyCity = njState
      ? await cityRepo.findOne({where: {stateId: njState.id, name: 'Jersey City'}})
      : null;

    const defaultLocations: Partial<Location>[] = [
      {
        name: 'Head Office',
        address: '100 Main Street',
        countryId: usCountry?.id,
        stateId: nyState?.id,
        cityId: nycCity?.id,
        postalCode: '10001',
      },
      {
        name: 'Downtown Branch',
        address: '250 Broadway Ave',
        countryId: usCountry?.id,
        stateId: nyState?.id,
        cityId: nycCity?.id,
        postalCode: '10007',
      },
      {
        name: 'Warehouse',
        address: '80 Logistics Park',
        countryId: usCountry?.id,
        stateId: njState?.id,
        cityId: jerseyCity?.id,
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
          `❌ Failed to seed locations for tenant "${tenant.subdomain}": ${(error as Error).message}`,
        );
      }
    }
  }
}
