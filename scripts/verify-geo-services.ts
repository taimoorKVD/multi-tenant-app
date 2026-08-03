/**
 * Exercises Nest GeoDataService + Countries/States/Cities services against JSON.
 * No database required.
 */
import {Test} from '@nestjs/testing';
import {GeoDataModule, GeoDataService} from '../src/master/data';
import {CountriesService} from '../src/master/countries/countries.service';
import {StatesService} from '../src/master/states/states.service';
import {CitiesService} from '../src/master/cities/cities.service';

async function main() {
  const moduleRef = await Test.createTestingModule({
    imports: [GeoDataModule],
    providers: [CountriesService, StatesService, CitiesService],
  }).compile();

  await moduleRef.init();

  const geo = moduleRef.get(GeoDataService);
  const countriesService = moduleRef.get(CountriesService);
  const statesService = moduleRef.get(StatesService);
  const citiesService = moduleRef.get(CitiesService);

  console.log('Loaded counts:', {
    countries: geo.getCountries().length,
    states: geo.getStates().length,
    cities: geo.getCities().length,
  });

  const countries = await countriesService.findAll(1, 5);
  console.log('countries.findAll page1 limit5:', {
    success: countries.success,
    total: countries.meta.total,
    sample: countries.data.map((c: any) => ({id: c.id, name: c.name, code: c.code})),
  });

  const countrySearch = await countriesService.search(10, {name: 'united'});
  console.log('countries.search "united":', {
    count: countrySearch.count,
    codes: countrySearch.data.map((c: any) => c.code),
  });

  const us = geo.getCountries().find((c) => c.code === 'US');
  if (!us) throw new Error('US not found');

  const usStates = await statesService.findAll(1, 5, us.id);
  console.log('states.findAll US page1:', {
    total: usStates.meta.total,
    sample: usStates.data.map((s: any) => ({
      id: s.id,
      name: s.name,
      country: s.country?.code,
    })),
  });

  const ny = geo.getStates().find((s) => s.countryId === us.id && s.name === 'New York');
  if (!ny) throw new Error('New York not found');

  const cities = await citiesService.search(10, {stateId: ny.id, name: 'york'});
  console.log('cities.search NY "york":', {
    count: cities.count,
    sample: cities.data.map((c: any) => ({
      id: c.id,
      name: c.name,
      state: c.state?.name,
      country: c.country?.code,
    })),
  });

  const oneCity = await citiesService.findOne(cities.data[0].id);
  console.log('cities.findOne:', {
    id: oneCity.data.id,
    name: oneCity.data.name,
    stateId: oneCity.data.stateId,
    countryId: oneCity.data.countryId,
  });

  if (countries.meta.total !== 250) throw new Error('Unexpected country total');
  if (usStates.meta.total < 50) throw new Error('Unexpected US state total');
  if (cities.count < 1) throw new Error('City search empty');

  console.log('PASS: Nest services work through JSON');
  await moduleRef.close();
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
