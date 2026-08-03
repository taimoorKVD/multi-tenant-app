import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {GeoDataService} from '../data';
import {CreateCountryDto, UpdateCountryDto} from './dto';

@Injectable()
export class CountriesService {
  constructor(private readonly geoData: GeoDataService) {}

  private normalizeCode(code?: string | null) {
    if (!code) return null;
    const value = code.trim().toUpperCase();
    return value.length ? value : null;
  }

  private matchesIgnoreCase(value: string | null | undefined, query: string) {
    return (value ?? '').toLowerCase().includes(query.toLowerCase());
  }

  async create(dto: CreateCountryDto) {
    const name = dto.name.trim();
    const code = this.normalizeCode(dto.code);
    const countries = [...this.geoData.getCountries()];

    if (countries.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      throw new BadRequestException('Country with this name already exists.');
    }

    if (code && countries.some((item) => item.code === code)) {
      throw new BadRequestException('Country with this code already exists.');
    }

    const saved = {
      id: this.geoData.nextId(countries),
      name,
      code,
    };
    countries.push(saved);
    this.geoData.saveCountries(countries);

    return {success: true, message: 'Country created successfully', data: saved};
  }

  async findAll(page = 1, limit?: number) {
    const parsedLimit = Number(limit);
    const take =
      limit === undefined
        ? undefined
        : parsedLimit <= 0
          ? undefined
          : Math.min(Math.max(parsedLimit, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);

    const sorted = [...this.geoData.getCountries()].sort((a, b) => b.id - a.id);
    const total = sorted.length;
    const data = take ? sorted.slice((currentPage - 1) * take, (currentPage - 1) * take + take) : sorted;

    return {
      success: true,
      data,
      meta: {
        total,
        page: currentPage,
        lastPage: take ? Math.ceil(total / take) || 1 : 1,
      },
    };
  }

  async search(
    limit = 15,
    filters?: {
      name?: string;
      code?: string;
    },
  ) {
    const parsedLimit = Number(limit);
    const take = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 15;
    const name = filters?.name?.trim();
    const code = filters?.code?.trim();

    if (!name && !code) {
      return {success: true, count: 0, data: []};
    }

    const data = this.geoData
      .getCountries()
      .filter((item) => {
        if (name && !this.matchesIgnoreCase(item.name, name)) return false;
        if (code && !this.matchesIgnoreCase(item.code, code)) return false;
        return true;
      })
      .sort((a, b) => b.id - a.id)
      .slice(0, take);

    return {success: true, count: data.length, data};
  }

  async findOne(id: number) {
    const record = this.geoData.getCountryById(id);
    if (!record) throw new NotFoundException('Country not found.');

    return {success: true, data: record};
  }

  async update(id: number, dto: UpdateCountryDto) {
    const countries = [...this.geoData.getCountries()];
    const index = countries.findIndex((item) => item.id === id);
    if (index < 0) throw new NotFoundException('Country not found.');

    const record = {...countries[index]};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (countries.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) {
        throw new BadRequestException('Country with this name already exists.');
      }
      record.name = name;
    }

    if (dto.code !== undefined) {
      const code = this.normalizeCode(dto.code);
      if (code && countries.some((item) => item.id !== id && item.code === code)) {
        throw new BadRequestException('Country with this code already exists.');
      }
      record.code = code;
    }

    countries[index] = record;
    this.geoData.saveCountries(countries);

    return {success: true, message: 'Country updated successfully', data: record};
  }

  async remove(id: number) {
    const countries = this.geoData.getCountries();
    if (!countries.some((item) => item.id === id)) {
      throw new NotFoundException('Country not found.');
    }

    if (this.geoData.getStates().some((item) => item.countryId === id)) {
      throw new BadRequestException('Cannot delete country that has states.');
    }

    if (this.geoData.getCities().some((item) => item.countryId === id)) {
      throw new BadRequestException('Cannot delete country that has cities.');
    }

    this.geoData.saveCountries(countries.filter((item) => item.id !== id));
    return {success: true, message: 'Country deleted successfully'};
  }
}
