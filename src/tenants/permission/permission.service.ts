import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Permission } from './entities';
import { DataSource, DeepPartial } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';
import {
  formatPermissionRecord,
  groupPermissionsByModule,
  resolvePermissionModuleValue,
} from '../../common/utils/permission-module';

@Injectable()
export class PermissionService extends TenantAbstractService<Permission> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(Permission));
  }

  protected sanitizeEntity<K>(entity: K | null): K | null {
    const sanitized = super.sanitizeEntity(entity);
    return formatPermissionRecord(sanitized as any) as K | null;
  }

  private withModule(data: DeepPartial<Permission>): DeepPartial<Permission> {
    const name = typeof data.name === 'string' ? data.name : undefined;
    return {
      ...data,
      module: resolvePermissionModuleValue(data.module as any, name),
    };
  }

  async findGrouped(req: any): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const permissions = await repo.find({ order: { id: 'ASC' } as any });
      const data = groupPermissionsByModule(permissions);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data,
      };
    } catch (error) {
      console.error('Tenant permission grouped fetch failed:', error);
      throw new InternalServerErrorException('Failed to fetch permissions');
    }
  }

  async create(req: any, data: DeepPartial<Permission>): Promise<any> {
    return super.create(req, this.withModule(data));
  }

  async update(req: any, id: number, data: DeepPartial<Permission>): Promise<any> {
    const existing = await this.getRepo(req).findOne({ where: { id } as any });
    const name =
      (typeof data.name === 'string' ? data.name : undefined) || existing?.name;
    const payload: DeepPartial<Permission> = { ...data };

    if (data.module !== undefined) {
      payload.module = resolvePermissionModuleValue(data.module as any, name);
    } else if (!existing?.module && name) {
      payload.module = resolvePermissionModuleValue(undefined, name);
    }

    return super.update(req, id, payload);
  }

  async search(
    req: any,
    limit = 15,
    filters?: {
      name?: string;
      module?: string;
    },
  ): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const parsedLimit = Number(limit);
      const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
      const name = filters?.name?.trim();
      const module = filters?.module?.trim();

      if (!name && !module) {
        return {
          success: true,
          tenant: req.tenantConnection.options.database,
          count: 0,
          data: [],
        };
      }

      const qb = repo
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

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data,
      };
    } catch (error) {
      console.error('Tenant permission search failed:', error);
      throw new InternalServerErrorException('Failed to search permissions');
    }
  }
}
