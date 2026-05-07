import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Role } from './entities';
import { DataSource } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';

@Injectable()
export class RoleService extends TenantAbstractService<Role> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(Role));
  }

  async search(
    req: any,
    limit = 15,
    filters?: {
      name?: string;
      permissionId?: number;
    },
  ): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);
      const name = filters?.name?.trim();
      const permissionId = filters?.permissionId;
      const hasFilters = Boolean(name || permissionId);

      if (!hasFilters) {
        return {
          success: true,
          tenant: req.tenantConnection.options.database,
          count: 0,
          data: [],
        };
      }

      const qb = repo
        .createQueryBuilder('role')
        .leftJoinAndSelect('role.permissions', 'permission');

      if (name) {
        qb.andWhere('role.name ILIKE :name', { name: `%${name}%` });
      }

      if (permissionId) {
        qb.andWhere('permission.id = :permissionId', { permissionId });
      }

      const data = await qb.orderBy('role.id', 'DESC').take(take).getMany();

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data,
      };
    } catch (error) {
      console.error('Tenant role search failed:', error);
      throw new InternalServerErrorException('Failed to search roles');
    }
  }
}
