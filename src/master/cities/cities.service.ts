import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {ILike, Repository} from 'typeorm';
import {City} from './entities';
import {CreateCityDto, UpdateCityDto} from './dto';
import {State} from '../states/entities';

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(City)
    private readonly cityRepo: Repository<City>,
    @InjectRepository(State)
    private readonly stateRepo: Repository<State>,
  ) {}

  private async ensureStateExists(stateId: number) {
    const state = await this.stateRepo.findOne({where: {id: stateId}});
    if (!state) {
      throw new NotFoundException('State not found.');
    }
  }

  async create(dto: CreateCityDto) {
    await this.ensureStateExists(dto.state_id);

    const name = dto.name.trim();
    const duplicate = await this.cityRepo.findOne({
      where: {
        name: ILike(name),
        stateId: dto.state_id,
      },
    });

    if (duplicate) {
      throw new BadRequestException('City with this name already exists in the selected state.');
    }

    const record = this.cityRepo.create({name, stateId: dto.state_id});
    const saved = await this.cityRepo.save(record);

    return {success: true, message: 'City created successfully', data: saved};
  }

  async findAll(page = 1, limit?: number, stateId?: number) {
    const parsedLimit = Number(limit);
    const take =
      limit === undefined
        ? undefined
        : parsedLimit <= 0
          ? undefined
          : Math.min(Math.max(parsedLimit, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);

    const where = stateId ? ({stateId} as any) : undefined;

    const [data, total] = await this.cityRepo.findAndCount({
      where,
      order: {id: 'DESC'},
      ...(take ? {take, skip: (currentPage - 1) * take} : {}),
      relations: ['state', 'state.country'],
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
      stateId?: number;
    },
  ) {
    const parsedLimit = Number(limit);
    const take = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 15;
    const name = filters?.name?.trim();
    const stateId = filters?.stateId;

    if (!name && !stateId) {
      return {success: true, count: 0, data: []};
    }

    const qb = this.cityRepo
      .createQueryBuilder('city')
      .leftJoinAndSelect('city.state', 'state')
      .leftJoinAndSelect('state.country', 'country')
      .orderBy('city.id', 'DESC')
      .take(take);

    if (name) {
      qb.andWhere('city.name ILIKE :name', {name: `%${name}%`});
    }

    if (stateId) {
      qb.andWhere('city.stateId = :stateId', {stateId});
    }

    const data = await qb.getMany();
    return {success: true, count: data.length, data};
  }

  async findOne(id: number) {
    const record = await this.cityRepo.findOne({where: {id}, relations: ['state', 'state.country']});
    if (!record) throw new NotFoundException('City not found.');

    return {success: true, data: record};
  }

  async update(id: number, dto: UpdateCityDto) {
    const record = await this.cityRepo.findOne({where: {id}});
    if (!record) throw new NotFoundException('City not found.');

    const stateId = dto.state_id ?? record.stateId;
    if (dto.state_id !== undefined) {
      await this.ensureStateExists(dto.state_id);
    }

    if (dto.name !== undefined || dto.state_id !== undefined) {
      const name = (dto.name ?? record.name).trim();
      const duplicate = await this.cityRepo.findOne({
        where: {name: ILike(name), stateId},
      });
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('City with this name already exists in the selected state.');
      }
      record.name = name;
    }

    if (dto.state_id !== undefined) {
      record.stateId = dto.state_id;
    }

    const saved = await this.cityRepo.save(record);
    return {success: true, message: 'City updated successfully', data: saved};
  }

  async remove(id: number) {
    const record = await this.cityRepo.findOne({where: {id}});
    if (!record) throw new NotFoundException('City not found.');

    await this.cityRepo.delete(id);
    return {success: true, message: 'City deleted successfully'};
  }
}