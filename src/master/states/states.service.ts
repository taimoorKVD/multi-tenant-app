import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {ILike, Repository} from 'typeorm';
import {State} from './entities';
import {CreateStateDto, UpdateStateDto} from './dto';
import {Country} from '../countries/entities';

@Injectable()
export class StatesService {
  constructor(
    @InjectRepository(State)
    private readonly stateRepo: Repository<State>,
    @InjectRepository(Country)
    private readonly countryRepo: Repository<Country>,
  ) {}

  private async ensureCountryExists(countryId: number) {
    const country = await this.countryRepo.findOne({where: {id: countryId}});
    if (!country) {
      throw new NotFoundException('Country not found.');
    }
  }

  async create(dto: CreateStateDto) {
    await this.ensureCountryExists(dto.country_id);

    const name = dto.name.trim();
    const duplicate = await this.stateRepo.findOne({
      where: {
        name: ILike(name),
        countryId: dto.country_id,
      },
    });

    if (duplicate) {
      throw new BadRequestException('State with this name already exists in the selected country.');
    }

    const record = this.stateRepo.create({name, countryId: dto.country_id});
    const saved = await this.stateRepo.save(record);

    return {success: true, message: 'State created successfully', data: saved};
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

    const where = countryId ? ({countryId} as any) : undefined;

    const [data, total] = await this.stateRepo.findAndCount({
      where,
      order: {id: 'DESC'},
      ...(take ? {take, skip: (currentPage - 1) * take} : {}),
      relations: ['country'],
    });

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

    const qb = this.stateRepo
      .createQueryBuilder('state')
      .leftJoinAndSelect('state.country', 'country')
      .orderBy('state.id', 'DESC')
      .take(take);

    if (name) {
      qb.andWhere('state.name ILIKE :name', {name: `%${name}%`});
    }

    if (countryId) {
      qb.andWhere('state.countryId = :countryId', {countryId});
    }

    const data = await qb.getMany();
    return {success: true, count: data.length, data};
  }

  async findOne(id: number) {
    const record = await this.stateRepo.findOne({where: {id}, relations: ['country']});
    if (!record) throw new NotFoundException('State not found.');

    return {success: true, data: record};
  }

  async update(id: number, dto: UpdateStateDto) {
    const record = await this.stateRepo.findOne({where: {id}});
    if (!record) throw new NotFoundException('State not found.');

    const countryId = dto.country_id ?? record.countryId;
    if (dto.country_id !== undefined) {
      await this.ensureCountryExists(dto.country_id);
    }

    if (dto.name !== undefined || dto.country_id !== undefined) {
      const name = (dto.name ?? record.name).trim();
      const duplicate = await this.stateRepo.findOne({
        where: {name: ILike(name), countryId},
      });
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('State with this name already exists in the selected country.');
      }
      record.name = name;
    }

    if (dto.country_id !== undefined) {
      record.countryId = dto.country_id;
    }

    const saved = await this.stateRepo.save(record);
    return {success: true, message: 'State updated successfully', data: saved};
  }

  async remove(id: number) {
    const record = await this.stateRepo.findOne({where: {id}});
    if (!record) throw new NotFoundException('State not found.');

    await this.stateRepo.delete(id);
    return {success: true, message: 'State deleted successfully'};
  }
}
