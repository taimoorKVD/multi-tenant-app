import {Injectable, OnModuleInit} from '@nestjs/common';
import {existsSync, readFileSync, writeFileSync} from 'fs';
import {join} from 'path';
import {CityRecord, CountryRecord, StateRecord} from './geo-data.types';

@Injectable()
export class GeoDataService implements OnModuleInit {
  private countries: CountryRecord[] = [];
  private states: StateRecord[] = [];
  private cities: CityRecord[] = [];

  private countriesById = new Map<number, CountryRecord>();
  private statesById = new Map<number, StateRecord>();
  private citiesById = new Map<number, CityRecord>();

  private countriesPath!: string;
  private statesPath!: string;
  private citiesPath!: string;

  onModuleInit() {
    this.countriesPath = this.resolveDataPath('countries.json');
    this.statesPath = this.resolveDataPath('states.json');
    this.citiesPath = this.resolveDataPath('cities.json');
    this.reloadAll();
  }

  private resolveDataPath(fileName: string): string {
    const candidates = [
      join(__dirname, fileName),
      join(process.cwd(), 'src', 'master', 'data', fileName),
      join(process.cwd(), 'dist', 'src', 'master', 'data', fileName),
      join(process.cwd(), 'dist', 'master', 'data', fileName),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(`Geo data file not found: ${fileName}. Checked: ${candidates.join(', ')}`);
  }

  private readJson<T>(filePath: string): T[] {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T[];
  }

  private writeJson<T>(filePath: string, data: T[]) {
    writeFileSync(filePath, JSON.stringify(data));
  }

  private rebuildIndexes() {
    this.countriesById = new Map(this.countries.map((item) => [item.id, item]));
    this.statesById = new Map(this.states.map((item) => [item.id, item]));
    this.citiesById = new Map(this.cities.map((item) => [item.id, item]));
  }

  reloadAll() {
    this.countries = this.readJson<CountryRecord>(this.countriesPath);
    this.states = this.readJson<StateRecord>(this.statesPath);
    this.cities = this.readJson<CityRecord>(this.citiesPath);
    this.rebuildIndexes();
  }

  getCountries(): CountryRecord[] {
    return this.countries;
  }

  getStates(): StateRecord[] {
    return this.states;
  }

  getCities(): CityRecord[] {
    return this.cities;
  }

  getCountryById(id: number): CountryRecord | undefined {
    return this.countriesById.get(id);
  }

  getStateById(id: number): StateRecord | undefined {
    return this.statesById.get(id);
  }

  getCityById(id: number): CityRecord | undefined {
    return this.citiesById.get(id);
  }

  saveCountries(data: CountryRecord[]) {
    this.countries = data;
    this.countriesById = new Map(data.map((item) => [item.id, item]));
    this.writeJson(this.countriesPath, data);
  }

  saveStates(data: StateRecord[]) {
    this.states = data;
    this.statesById = new Map(data.map((item) => [item.id, item]));
    this.writeJson(this.statesPath, data);
  }

  saveCities(data: CityRecord[]) {
    this.cities = data;
    this.citiesById = new Map(data.map((item) => [item.id, item]));
    this.writeJson(this.citiesPath, data);
  }

  nextId(items: Array<{id: number}>): number {
    let max = 0;
    for (const item of items) {
      if (item.id > max) max = item.id;
    }
    return max + 1;
  }

  withCountry<T extends {countryId: number}>(record: T) {
    return {
      ...record,
      country: this.getCountryById(record.countryId) ?? null,
    };
  }

  withCityRelations(record: CityRecord) {
    return {
      ...record,
      state: this.getStateById(record.stateId) ?? null,
      country: this.getCountryById(record.countryId) ?? null,
    };
  }
}
