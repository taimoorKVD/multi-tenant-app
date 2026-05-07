import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MasterAbstractService } from '../../common/abstract';
import { Permission } from './entities';

@Injectable()
export class PermissionService extends MasterAbstractService<Permission> {
  constructor(@InjectRepository(Permission) repo: Repository<Permission>) {
    super(repo);
  }

  async search(limit = 15, filters?: {name?: string}) {
    try {
      const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);
      const name = filters?.name?.trim();

      if (!name) {
        return {success: true, count: 0, data: []};
      }

      const data = await this.repository
        .createQueryBuilder('permission')
        .where('permission.name ILIKE :name', {name: `%${name}%`})
        .orderBy('permission.id', 'DESC')
        .take(take)
        .getMany();

      return {success: true, count: data.length, data};
    } catch (error) {
      console.error('Master permission search failed:', error);
      throw new InternalServerErrorException('Failed to search permissions');
    }
  }
}
