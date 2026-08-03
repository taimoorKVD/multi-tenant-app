/**
 * Smoke-test geo JSON loading + service-style queries (no DB required).
 */
const {existsSync, readFileSync} = require('fs');
const {join} = require('path');

const root = process.cwd();
const candidatesFor = (file) => [
  join(root, 'src', 'master', 'data', file),
  join(root, 'dist', 'src', 'master', 'data', file),
  join(root, 'dist', 'master', 'data', file),
];

function resolve(file) {
  for (const p of candidatesFor(file)) {
    if (existsSync(p)) return p;
  }
  throw new Error(`Missing ${file}`);
}

function load(file) {
  const path = resolve(file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return {path, data};
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function matchesIgnoreCase(value, query) {
  return (value ?? '').toLowerCase().includes(query.toLowerCase());
}

const results = [];

try {
  const countriesLoaded = load('countries.json');
  const statesLoaded = load('states.json');
  const citiesLoaded = load('cities.json');

  const countries = countriesLoaded.data;
  const states = statesLoaded.data;
  const cities = citiesLoaded.data;

  results.push(`countries.json → ${countriesLoaded.path} (${countries.length})`);
  results.push(`states.json → ${statesLoaded.path} (${states.length})`);
  results.push(`cities.json → ${citiesLoaded.path} (${cities.length})`);

  assert(countries.length === 250, `Expected 250 countries, got ${countries.length}`);
  assert(states.length === 5308, `Expected 5308 states, got ${states.length}`);
  assert(cities.length === 152967, `Expected 152967 cities, got ${cities.length}`);

  const us = countries.find((c) => c.code === 'US');
  assert(us, 'US country not found');
  assert(us.id === 236, `US id expected 236, got ${us.id}`);

  const ny = states.find((s) => s.countryId === us.id && s.name === 'New York');
  const nj = states.find((s) => s.countryId === us.id && s.name === 'New Jersey');
  assert(ny, 'New York state not found');
  assert(nj, 'New Jersey state not found');

  const nyc = cities.find((c) => c.stateId === ny.id && c.name === 'New York City');
  const jersey = cities.find((c) => c.stateId === nj.id && c.name === 'Jersey City');
  assert(nyc, 'New York City not found');
  assert(jersey, 'Jersey City not found');

  // Simulate countries search
  const countrySearch = countries
    .filter((c) => matchesIgnoreCase(c.name, 'united'))
    .sort((a, b) => b.id - a.id)
    .slice(0, 15);
  assert(countrySearch.length > 0, 'Country search for "united" returned empty');
  assert(
    countrySearch.some((c) => c.code === 'US'),
    'Country search missing US',
  );

  // Simulate states findAll filtered by country
  const usStates = states.filter((s) => s.countryId === us.id);
  assert(usStates.length > 50, `Expected many US states, got ${usStates.length}`);

  // Simulate cities search by state + name
  const citySearch = cities
    .filter((c) => c.stateId === ny.id && matchesIgnoreCase(c.name, 'york'))
    .sort((a, b) => b.id - a.id)
    .slice(0, 15);
  assert(citySearch.length > 0, 'City search for york in NY returned empty');
  assert(
    citySearch.some((c) => c.name === 'New York City'),
    'City search missing New York City',
  );

  // Simulate pagination
  const page = 1;
  const limit = 10;
  const sortedCountries = [...countries].sort((a, b) => b.id - a.id);
  const pageData = sortedCountries.slice((page - 1) * limit, page * limit);
  assert(pageData.length === 10, 'Country pagination failed');

  // Relation integrity sample
  assert(nyc.countryId === us.id, 'NYC countryId mismatch');
  assert(nyc.stateId === ny.id, 'NYC stateId mismatch');

  results.push(`US id=${us.id}, NY id=${ny.id}, NJ id=${nj.id}`);
  results.push(`NYC id=${nyc.id}, Jersey City id=${jersey.id}`);
  results.push(`country search "united": ${countrySearch.length} hits`);
  results.push(`US states: ${usStates.length}`);
  results.push(`NY cities matching "york": ${citySearch.length}`);
  results.push(`country page1 limit10: ${pageData.map((c) => c.code).join(',')}`);

  console.log('PASS: geo JSON works correctly');
  for (const line of results) console.log(' -', line);
  process.exit(0);
} catch (err) {
  console.error('FAIL:', err.message);
  for (const line of results) console.error(' -', line);
  process.exit(1);
}
