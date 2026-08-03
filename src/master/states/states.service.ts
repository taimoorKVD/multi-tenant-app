import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {GeoDataService} from '../data';
import {CreateStateDto, UpdateStateDto} from './dto';

@Injectable()
export class StatesService {
  constructor(private readonly geoData: GeoDataService) {}

  private ensureCountryExists(countryId: number) {
    if (!this.geoData.getCountryById(countryId)) {
      throw new NotFoundException('Country not found.');
    }
  }

  private matchesIgnoreCase(value: string, query: string) {
    return value.toLowerCase().includes(query.toLowerCase());
  }

  async create(dto: CreateStateDto) {
    this.ensureCountryExists(dto.country_id);

    const name = dto.name.trim();
    const states = [...this.geoData.getStates()];

    if (
      states.some(
        (item) => item.countryId === dto.country_id && item.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new BadRequestException('State with this name already exists in the selected country.');
    }

    const saved = {
      id: this.geoData.nextId(states),
      name,
      countryId: dto.country_id,
    };
    states.push(saved);
    this.geoData.saveStates(states);

    return {
      success: true,
      message: 'State created successfully',
      data: this.geoData.withCountry(saved),
    };
  }

  async findAll(page = 1, limit?: number, countryId?: number) {
    const parsedLimit = Number(limit);
    const take =
      limit === undefined
        ? undefined
        : parsedLimit <= 0
          ? undefined
          : Math.min(Math.max(parsedLimit, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);

    const filtered = this.geoData
      .getStates()
      .filter((item) => (countryId ? item.countryId === countryId : true))
      .sort((a, b) => b.id - a.id);

    const total = filtered.length;
    const pageItems = take
      ? filtered.slice((currentPage - 1) * take, (currentPage - 1) * take + take)
      : filtered;
    const data = pageItems.map((item) => this.geoData.withCountry(item));

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
      countryId?: number;
    },
  ) {
    const parsedLimit = Number(limit);
    const take = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 15;
    const name = filters?.name?.trim();
    const countryId = filters?.countryId;

    if (!name && !countryId) {
      return {success: true, count: 0, data: []};
    }

    const data = this.geoData
      .getStates()
      .filter((item) => {
        if (name && !this.matchesIgnoreCase(item.name, name)) return false;
        if (countryId && item.countryId !== countryId) return false;
        return true;
      })
      .sort((a, b) => b.id - a.id)
      .slice(0, take)
      .map((item) => this.geoData.withCountry(item));

    return {success: true, count: data.length, data};
  }

  async findOne(id: number) {
    const record = this.geoData.getStateById(id);
    if (!record) throw new NotFoundException('State not found.');

    return {success: true, data: this.geoData.withCountry(record)};
  }

  async update(id: number, dto: UpdateStateDto) {
    const states = [...this.geoData.getStates()];
    const index = states.findIndex((item) => item.id === id);
    if (index < 0) throw new NotFoundException('State not found.');

    const record = {...states[index]};
    const countryId = dto.country_id ?? record.countryId;

    if (dto.country_id !== undefined) {
      this.ensureCountryExists(dto.country_id);
    }

    if (dto.name !== undefined || dto.country_id !== undefined) {
      const name = (dto.name ?? record.name).trim();
      if (
        states.some(
          (item) =>
            item.id !== id &&
            item.countryId === countryId &&
            item.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        throw new BadRequestException('State with this name already exists in the selected country.');
      }
      record.name = name;
    }

    if (dto.country_id !== undefined) {
      record.countryId = dto.country_id;
    }

    states[index] = record;
    this.geoData.saveStates(states);

    return {
      success: true,
      message: 'State updated successfully',
      data: this.geoData.withCountry(record),
    };
  }

  async remove(id: number) {
    const states = this.geoData.getStates();
    if (!states.some((item) => item.id === id)) {
      throw new NotFoundException('State not found.');
    }

    if (this.geoData.getCities().some((item) => item.stateId === id)) {
      throw new BadRequestException('Cannot delete state that has cities.');
    }

    this.geoData.saveStates(states.filter((item) => item.id !== id));
    return {success: true, message: 'State deleted successfully'};
  }
}
