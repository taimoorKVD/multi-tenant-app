import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Timezone } from './entities';

@Injectable()
export class TimezonesService {
  constructor(
    @InjectRepository(Timezone)
    private readonly timezoneRepo: Repository<Timezone>,
  ) {}

  async findAll(page = 1, limit?: number) {
    const parsedLimit = Number(limit);
    const take =
      limit === undefined
        ? undefined
        : parsedLimit <= 0
          ? undefined
          : Math.min(Math.max(parsedLimit, 1), 500);
    const currentPage = Math.max(Number(page) || 1, 1);

    const [data, total] = await this.timezoneRepo.findAndCount({
      order: { name: 'ASC' },
      ...(take ? { take, skip: (currentPage - 1) * take } : {}),
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
    limit = 50,
    filters?: {
      name?: string;
      region?: string;
      q?: string;
    },
  ) {
    const parsedLimit = Number(limit);
    const take = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;
    const name = filters?.name?.trim();
    const region = filters?.region?.trim();
    const q = filters?.q?.trim();

    if (!name && !region && !q) {
      return { success: true, count: 0, data: [] };
    }

    const qb = this.timezoneRepo.createQueryBuilder('tz');

    if (q) {
      qb.andWhere('(tz.name ILIKE :q OR tz.label ILIKE :q OR tz.region ILIKE :q)', {
        q: `%${q}%`,
      });
    }
    if (name) {
      qb.andWhere('tz.name ILIKE :name', { name: `%${name}%` });
    }
    if (region) {
      qb.andWhere('tz.region ILIKE :region', { region: `%${region}%` });
    }

    const data = await qb.orderBy('tz.name', 'ASC').take(take).getMany();
    return { success: true, count: data.length, data };
  }

  async findOne(id: number) {
    const record = await this.timezoneRepo.findOne({ where: { id } });
    if (!record) {
      return null;
    }
    return { success: true, data: record };
  }

  async findByName(name: string) {
    const record = await this.timezoneRepo.findOne({
      where: { name: ILike(name.trim()) },
    });
    if (!record) {
      return null;
    }
    return { success: true, data: record };
  }
}
