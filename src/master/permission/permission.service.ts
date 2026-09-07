import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { MasterAbstractService } from '../../common/abstract';
import {
  formatPermissionRecord,
  groupPermissionsByModule,
  resolvePermissionModuleValue,
} from '../../common/utils/permission-module';
import { Permission } from './entities';

@Injectable()
export class PermissionService extends MasterAbstractService<Permission> {
  constructor(@InjectRepository(Permission) repo: Repository<Permission>) {
    super(repo);
  }

  private withModule(data: DeepPartial<Permission>): DeepPartial<Permission> {
    const name = typeof data.name === 'string' ? data.name : undefined;
    return {
      ...data,
      module: resolvePermissionModuleValue(data.module as any, name),
    };
  }

  private formatSingle(data: any): any {
    return formatPermissionRecord(data);
  }

  async findGrouped(): Promise<any> {
    try {
      const permissions = await this.repository.find({ order: { id: 'ASC' } as any });
      const data = groupPermissionsByModule(permissions);
      return { success: true, count: data.length, data };
    } catch (error) {
      console.error('Master permission grouped fetch failed:', error);
      throw new InternalServerErrorException('Failed to fetch permissions');
    }
  }

  async create(data: DeepPartial<Permission>): Promise<any> {
    const result = await super.create(this.withModule(data));
    return { ...result, data: this.formatSingle(result.data) };
  }

  async update(id: number, data: DeepPartial<Permission>): Promise<any> {
    const existing = await this.repository.findOne({ where: { id } as any });
    const name =
      (typeof data.name === 'string' ? data.name : undefined) || existing?.name;
    const payload: DeepPartial<Permission> = { ...data };

    if (data.module !== undefined) {
      payload.module = resolvePermissionModuleValue(data.module as any, name);
    } else if (!existing?.module && name) {
      payload.module = resolvePermissionModuleValue(undefined, name);
    }

    const result = await super.update(id, payload);
    return { ...result, data: this.formatSingle(result.data) };
  }

  async paginate(): Promise<any> {
    return this.findGrouped();
  }

  async findAll(): Promise<any> {
    return this.findGrouped();
  }

  async findOne(id: number, relations: string[] = []): Promise<any> {
    const result = await super.findOne(id, relations);
    return { ...result, data: this.formatSingle(result.data) };
  }

  async search(limit = 15, filters?: { name?: string; module?: string }) {
    try {
      const parsedLimit = Number(limit);
      const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
      const name = filters?.name?.trim();
      const module = filters?.module?.trim();

      if (!name && !module) {
        return { success: true, count: 0, data: [] };
      }

      const qb = this.repository
        .createQueryBuilder('permission')
        .orderBy('permission.id', 'ASC')
        .take(take);

      if (name) {
        qb.andWhere('permission.name ILIKE :name', { name: `%${name}%` });
      }
      if (module) {
        qb.andWhere('permission.module ILIKE :module', { module: `%${module}%` });
      }

      const permissions = await qb.getMany();
      const data = groupPermissionsByModule(permissions);

      return { success: true, count: data.length, data };
    } catch (error) {
      console.error('Master permission search failed:', error);
      throw new InternalServerErrorException('Failed to search permissions');
    }
  }
}
