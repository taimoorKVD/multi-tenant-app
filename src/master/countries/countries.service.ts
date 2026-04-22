import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {ILike, Repository} from 'typeorm';
import {Country} from './entities';
import {CreateCountryDto, UpdateCountryDto} from './dto';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepo: Repository<Country>,
  ) {}

  private normalizeCode(code?: string | null) {
    if (!code) return null;
    const value = code.trim().toUpperCase();
    return value.length ? value : null;
  }

  async create(dto: CreateCountryDto) {
    const name = dto.name.trim();
    const code = this.normalizeCode(dto.code);

    const existingByName = await this.countryRepo.findOne({where: {name: ILike(name)}});
    if (existingByName) {
      throw new BadRequestException('Country with this name already exists.');
    }

    if (code) {
      const existingByCode = await this.countryRepo.findOne({where: {code}});
      if (existingByCode) {
        throw new BadRequestException('Country with this code already exists.');
      }
    }

    const record = this.countryRepo.create({name, code});
    const saved = await this.countryRepo.save(record);

    return {success: true, message: 'Country created successfully', data: saved};
  }

  async findAll(page = 1, limit = 15) {
    const take = Math.min(Math.max(Number(limit) || 15, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);

    const [data, total] = await this.countryRepo.findAndCount({
      order: {name: 'ASC'},
      take,
      skip: (currentPage - 1) * take,
    });

    return {
      success: true,
      data,
      meta: {
        total,
        page: currentPage,
        lastPage: Math.ceil(total / take) || 1,
      },
    };
  }

  async search(q: string, limit = 10) {
    const keyword = (q || '').trim();
    const take = Math.min(Math.max(Number(limit) || 10, 1), 100);

    if (!keyword) {
      return {success: true, count: 0, data: []};
    }

    const data = await this.countryRepo.find({
      where: [{name: ILike(`%${keyword}%`)}, {code: ILike(`%${keyword}%`)}],
      order: {name: 'ASC'},
      take,
    });

    return {success: true, count: data.length, data};
  }

  async findOne(id: number) {
    const record = await this.countryRepo.findOne({where: {id}});
    if (!record) throw new NotFoundException('Country not found.');

    return {success: true, data: record};
  }

  async update(id: number, dto: UpdateCountryDto) {
    const record = await this.countryRepo.findOne({where: {id}});
    if (!record) throw new NotFoundException('Country not found.');

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const duplicate = await this.countryRepo.findOne({where: {name: ILike(name)}});
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('Country with this name already exists.');
      }
      record.name = name;
    }

    if (dto.code !== undefined) {
      const code = this.normalizeCode(dto.code);
      if (code) {
        const duplicateCode = await this.countryRepo.findOne({where: {code}});
        if (duplicateCode && duplicateCode.id !== id) {
          throw new BadRequestException('Country with this code already exists.');
        }
      }
      record.code = code;
    }

    const saved = await this.countryRepo.save(record);
    return {success: true, message: 'Country updated successfully', data: saved};
  }

  async remove(id: number) {
    const record = await this.countryRepo.findOne({where: {id}});
    if (!record) throw new NotFoundException('Country not found.');

    await this.countryRepo.delete(id);
    return {success: true, message: 'Country deleted successfully'};
  }
}
