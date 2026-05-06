import {ISeeder} from '../interfaces/seeder.interface';
import {MasterDataSource} from '../datasource';
import {City} from '../../master/cities/entities';
import {Country} from '../../master/countries/entities';
import {State} from '../../master/states/entities';

export class CitySeeder implements ISeeder {
  name = 'CitySeeder';

  async run() {
    const cityRepo = MasterDataSource.getRepository(City);
    const countryRepo = MasterDataSource.getRepository(Country);
    const stateRepo = MasterDataSource.getRepository(State);

    if (await cityRepo.count()) {
      console.log('⚠️  Cities already exist. Skipping seeding.');
      return;
    }

    const countries = await countryRepo.find();
    const states = await stateRepo.find();

    if (!countries.length || !states.length) {
      console.log('⚠️  Countries or states are missing. Run CountrySeeder and StateSeeder first.');
      return;
    }

    const countriesById = new Map(countries.map((country) => [country.id, country.code]));
    const statesByKey = new Map(
      states.map((state) => [`${countriesById.get(state.countryId) || ''}:${state.name}`, state]),
    );

    const rows: Array<{countryCode: string; stateName: string; cityName: string}> = [
      {countryCode: 'US', stateName: 'California', cityName: 'Los Angeles'},
      {countryCode: 'US', stateName: 'California', cityName: 'San Francisco'},
      {countryCode: 'US', stateName: 'Texas', cityName: 'Houston'},
      {countryCode: 'US', stateName: 'Texas', cityName: 'Dallas'},
      {countryCode: 'US', stateName: 'New York', cityName: 'New York City'},
      {countryCode: 'US', stateName: 'Florida', cityName: 'Miami'},
      {countryCode: 'CA', stateName: 'Ontario', cityName: 'Toronto'},
      {countryCode: 'CA', stateName: 'Ontario', cityName: 'Ottawa'},
      {countryCode: 'CA', stateName: 'Quebec', cityName: 'Montreal'},
      {countryCode: 'CA', stateName: 'British Columbia', cityName: 'Vancouver'},
      {countryCode: 'GB', stateName: 'England', cityName: 'London'},
      {countryCode: 'GB', stateName: 'England', cityName: 'Manchester'},
      {countryCode: 'GB', stateName: 'Scotland', cityName: 'Glasgow'},
      {countryCode: 'AU', stateName: 'New South Wales', cityName: 'Sydney'},
      {countryCode: 'AU', stateName: 'Victoria', cityName: 'Melbourne'},
      {countryCode: 'AU', stateName: 'Queensland', cityName: 'Brisbane'},
      {countryCode: 'IN', stateName: 'Maharashtra', cityName: 'Mumbai'},
      {countryCode: 'IN', stateName: 'Delhi', cityName: 'New Delhi'},
      {countryCode: 'IN', stateName: 'Karnataka', cityName: 'Bengaluru'},
      {countryCode: 'IN', stateName: 'Tamil Nadu', cityName: 'Chennai'},
      {countryCode: 'DE', stateName: 'Berlin', cityName: 'Berlin'},
      {countryCode: 'DE', stateName: 'Bavaria', cityName: 'Munich'},
      {countryCode: 'DE', stateName: 'Hamburg', cityName: 'Hamburg'},
      {countryCode: 'FR', stateName: 'Île-de-France', cityName: 'Paris'},
      {countryCode: 'FR', stateName: 'Provence-Alpes-Côte d\'Azur', cityName: 'Marseille'},
      {countryCode: 'FR', stateName: 'Auvergne-Rhône-Alpes', cityName: 'Lyon'},
      {countryCode: 'BR', stateName: 'São Paulo', cityName: 'São Paulo'},
      {countryCode: 'BR', stateName: 'Rio de Janeiro', cityName: 'Rio de Janeiro'},
      {countryCode: 'BR', stateName: 'Bahia', cityName: 'Salvador'},
      {countryCode: 'AE', stateName: 'Dubai', cityName: 'Dubai'},
      {countryCode: 'AE', stateName: 'Abu Dhabi', cityName: 'Abu Dhabi'},
      {countryCode: 'SA', stateName: 'Riyadh', cityName: 'Riyadh'},
      {countryCode: 'SA', stateName: 'Makkah', cityName: 'Jeddah'},
      {countryCode: 'PK', stateName: 'Punjab', cityName: 'Lahore'},
      {countryCode: 'PK', stateName: 'Sindh', cityName: 'Karachi'},
      {countryCode: 'BD', stateName: 'Dhaka', cityName: 'Dhaka'},
      {countryCode: 'BD', stateName: 'Chittagong', cityName: 'Chattogram'},
      {countryCode: 'ZA', stateName: 'Gauteng', cityName: 'Johannesburg'},
      {countryCode: 'ZA', stateName: 'Western Cape', cityName: 'Cape Town'},
      {countryCode: 'NG', stateName: 'Lagos', cityName: 'Lagos'},
      {countryCode: 'EG', stateName: 'Cairo', cityName: 'Cairo'},
    ];

    const cities = rows
      .map((row) => {
        const state = statesByKey.get(`${row.countryCode}:${row.stateName}`);
        if (!state) {
          console.log(
            `⚠️  Missing state for city seed: ${row.cityName} (${row.stateName}, ${row.countryCode})`,
          );
          return null;
        }

        return cityRepo.create({
          name: row.cityName,
          stateId: state.id,
        });
      })
      .filter((city): city is City => city !== null);

    if (!cities.length) {
      console.log('⚠️  No valid city rows were resolved. Skipping seeding.');
      return;
    }

    await cityRepo.save(cities);
    console.log(`✅ Seeded ${cities.length} cities successfully.`);
  }
}