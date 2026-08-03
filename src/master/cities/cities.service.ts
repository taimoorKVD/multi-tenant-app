import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {GeoDataService} from '../data';
import {CreateCityDto, UpdateCityDto} from './dto';

@Injectable()
export class CitiesService {
  constructor(private readonly geoData: GeoDataService) {}

  private getStateOrFail(stateId: number) {
    const state = this.geoData.getStateById(stateId);
    if (!state) {
      throw new NotFoundException('State not found.');
    }
    return state;
  }

  private matchesIgnoreCase(value: string, query: string) {
    return value.toLowerCase().includes(query.toLowerCase());
  }

  async create(dto: CreateCityDto) {
    const state = this.getStateOrFail(dto.state_id);
    const name = dto.name.trim();
    const cities = [...this.geoData.getCities()];

    if (
      cities.some(
        (item) => item.stateId === dto.state_id && item.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new BadRequestException('City with this name already exists in the selected state.');
    }

    const saved = {
      id: this.geoData.nextId(cities),
      name,
      stateId: dto.state_id,
      countryId: state.countryId,
    };
    cities.push(saved);
    this.geoData.saveCities(cities);

    return {
      success: true,
      message: 'City created successfully',
      data: this.geoData.withCityRelations(saved),
    };
  }

  async findAll(
    page = 1,
    limit?: number,
    filters?: {stateId?: number; countryId?: number},
  ) {
    const parsedLimit = Number(limit);
    const take =
      limit === undefined
        ? undefined
        : parsedLimit <= 0
          ? undefined
          : parsedLimit;

    const currentPage = Math.max(Number(page) || 1, 1);

    const filtered = this.geoData
      .getCities()
      .filter((item) => {
        if (filters?.stateId && item.stateId !== filters.stateId) return false;
        if (filters?.countryId && item.countryId !== filters.countryId) return false;
        return true;
      })
      .sort((a, b) => b.id - a.id);

    const total = filtered.length;
    const pageItems = take
      ? filtered.slice((currentPage - 1) * take, (currentPage - 1) * take + take)
      : filtered;
    const data = pageItems.map((item) => this.geoData.withCityRelations(item));

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
      stateId?: number;
      countryId?: number;
    },
  ) {
    const parsedLimit = Number(limit);
    const take = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 15;
    const name = filters?.name?.trim();
    const stateId = filters?.stateId;
    const countryId = filters?.countryId;

    if (!name && !stateId && !countryId) {
      return {success: true, count: 0, data: []};
    }

    const data = this.geoData
      .getCities()
      .filter((item) => {
        if (name && !this.matchesIgnoreCase(item.name, name)) return false;
        if (stateId && item.stateId !== stateId) return false;
        if (countryId && item.countryId !== countryId) return false;
        return true;
      })
      .sort((a, b) => b.id - a.id)
      .slice(0, take)
      .map((item) => this.geoData.withCityRelations(item));

    return {success: true, count: data.length, data};
  }

  async findOne(id: number) {
    const record = this.geoData.getCityById(id);
    if (!record) throw new NotFoundException('City not found.');

    return {success: true, data: this.geoData.withCityRelations(record)};
  }

  async update(id: number, dto: UpdateCityDto) {
    const cities = [...this.geoData.getCities()];
    const index = cities.findIndex((item) => item.id === id);
    if (index < 0) throw new NotFoundException('City not found.');

    const record = {...cities[index]};
    const stateId = dto.state_id ?? record.stateId;
    let countryId = record.countryId;

    if (dto.state_id !== undefined) {
      const state = this.getStateOrFail(dto.state_id);
      countryId = state.countryId;
    }

    if (dto.name !== undefined || dto.state_id !== undefined) {
      const name = (dto.name ?? record.name).trim();
      if (
        cities.some(
          (item) =>
            item.id !== id && item.stateId === stateId && item.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        throw new BadRequestException('City with this name already exists in the selected state.');
      }
      record.name = name;
    }

    if (dto.state_id !== undefined) {
      record.stateId = dto.state_id;
      record.countryId = countryId;
    }

    cities[index] = record;
    this.geoData.saveCities(cities);

    return {
      success: true,
      message: 'City updated successfully',
      data: this.geoData.withCityRelations(record),
    };
  }

  async remove(id: number) {
    const cities = this.geoData.getCities();
    if (!cities.some((item) => item.id === id)) {
      throw new NotFoundException('City not found.');
    }

    this.geoData.saveCities(cities.filter((item) => item.id !== id));
    return {success: true, message: 'City deleted successfully'};
  }
}
