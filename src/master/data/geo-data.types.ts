export interface CountryRecord {
  id: number;
  name: string;
  code: string | null;
}

export interface StateRecord {
  id: number;
  name: string;
  countryId: number;
}

export interface CityRecord {
  id: number;
  name: string;
  stateId: number;
  countryId: number;
}
