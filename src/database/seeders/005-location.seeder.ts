import {existsSync, readFileSync} from 'fs';
import {join} from 'path';
import {ISeeder} from '../interfaces/seeder.interface';
import {MasterDataSource, getTenantDataSource} from '../datasource';
import {Tenant} from '../../master/tenants/entities';
import {Location} from '../../tenants/locations/entities';

type CountryRecord = {id: number; name: string; code: string | null};
type StateRecord = {id: number; name: string; countryId: number};
type CityRecord = {id: number; name: string; stateId: number; countryId: number};

export class LocationSeeder implements ISeeder {
  name = 'LocationSeeder';

  private resolveGeoPath(fileName: string) {
    const candidates = [
      join(process.cwd(), 'src', 'master', 'data', fileName),
      join(process.cwd(), 'dist', 'src', 'master', 'data', fileName),
      join(__dirname, '..', '..', 'master', 'data', fileName),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(`Geo data file not found: ${fileName}`);
  }

  private readJson<T>(fileName: string): T[] {
    return JSON.parse(readFileSync(this.resolveGeoPath(fileName), 'utf8')) as T[];
  }

  async run() {
    const tenantRepo = MasterDataSource.getRepository(Tenant);
    const tenants = await tenantRepo.find();

    if (!tenants.length) {
      console.log('⚠️  No tenants found. Skipping location seeding.');
      return;
    }

    const countries = this.readJson<CountryRecord>('countries.json');
    const states = this.readJson<StateRecord>('states.json');
    const cities = this.readJson<CityRecord>('cities.json');

    const usCountry = countries.find((country) => country.code === 'US');
    const nyState = usCountry
      ? states.find((state) => state.countryId === usCountry.id && state.name === 'New York')
      : undefined;
    const njState = usCountry
      ? states.find((state) => state.countryId === usCountry.id && state.name === 'New Jersey')
      : undefined;
    const nycCity = nyState
      ? cities.find((city) => city.stateId === nyState.id && city.name === 'New York City')
      : undefined;
    const jerseyCity = njState
      ? cities.find((city) => city.stateId === njState.id && city.name === 'Jersey City')
      : undefined;

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
