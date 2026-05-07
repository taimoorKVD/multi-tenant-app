import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Permission } from './entities';
import { DataSource } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';

@Injectable()
export class PermissionService extends TenantAbstractService<Permission> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(Permission));
  }

  async search(
    req: any,
    limit = 15,
    filters?: {
      name?: string;
    },
  ): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);
      const name = filters?.name?.trim();

      if (!name) {
        return {
          success: true,
          tenant: req.tenantConnection.options.database,
          count: 0,
          data: [],
        };
      }

      const data = await repo
        .createQueryBuilder('permission')
        .where('permission.name ILIKE :name', { name: `%${name}%` })
        .orderBy('permission.id', 'DESC')
        .take(take)
        .getMany();

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
