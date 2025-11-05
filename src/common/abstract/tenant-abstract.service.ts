import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, DeepPartial, ObjectLiteral, Repository } from 'typeorm';

@Injectable()
export abstract class TenantAbstractService<T extends ObjectLiteral> {
  protected paginateLimit = 15;
  protected pageDefault = 1;

  protected constructor(protected readonly repository: Repository<T>) {}

  protected getRepo(req: any): Repository<T> {
    const tenantConnection: DataSource = req?.tenantConnection;
    if (!tenantConnection) {
      throw new BadRequestException(
        'Tenant connection not found. Ensure tenant context or subdomain is provided.',
      );
    }

    // Cast to Repository<T> explicitly to satisfy TypeORM’s internal type system
    return tenantConnection.getRepository<T>(
      this.repository.target as any,
    ) as Repository<T>;
  }

  /**
   * Create record
   */
  async create(req: any, data: DeepPartial<T>): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const entity = repo.create(data);
      const saved = await repo.save(entity);

      return {
        success: true,
        message: 'Record created successfully',
        tenant: req.tenantConnection.options.database,
        data: saved,
      };
    } catch (error) {
      console.error('❌ Create operation failed:', error);
      throw new InternalServerErrorException('Failed to create record');
    }
  }

  /**
   * Get all records
   */
  async findAll(req: any, relations: string[] = []): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const data = await repo.find({ relations });
      const sanitized = data.map(({ password, ...rest }) => rest);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: sanitized.length,
        data: sanitized,
      };
    } catch (error) {
      console.error('❌ Fetch all failed:', error);
      throw new InternalServerErrorException('Failed to retrieve records');
    }
  }

  /**
   * Paginated list
   */
  async paginate(
    req: any,
    page = this.pageDefault,
    relations: string[] = [],
  ): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const take = this.paginateLimit;
      const [data, total] = await repo.findAndCount({
        take,
        skip: (page - 1) * take,
        relations,
        order: { id: 'DESC' } as any,
      });
      const sanitized = data.map(({ password, ...rest }) => rest);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        meta: {
          total,
          page,
          lastPage: Math.ceil(total / take),
        },
        data: sanitized,
      };
    } catch (error) {
      console.error('❌ Pagination failed:', error);
      throw new InternalServerErrorException('Failed to paginate records');
    }
  }

  /**
   * Find one record
   */
  async findOne(req: any, id: number, relations: string[] = []): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const entity = await repo.findOne({ where: { id } as any, relations });
      if (!entity)
        throw new NotFoundException(`Record with ID ${id} not found`);
      delete (entity as any).password;
      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        data: entity,
      };
    } catch (error) {
      console.error('❌ Find one failed:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Failed to retrieve record');
    }
  }

  /**
   * Update record
   */
  async update(req: any, id: number, data: DeepPartial<T>): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const entity = await repo.findOneBy({ id } as any);
      if (!entity)
        throw new NotFoundException(`Record with ID ${id} not found`);

      await repo.update(id, data as any);
      const updated = await repo.findOneBy({ id } as any);

      return {
        success: true,
        message: 'Record updated successfully',
        tenant: req.tenantConnection.options.database,
        data: updated,
      };
    } catch (error) {
      console.error('❌ Update failed:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Failed to update record');
    }
  }

  /**
   * Delete record
   */
  async delete(req: any, id: number): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const entity = await repo.findOneBy({ id } as any);
      if (!entity)
        throw new NotFoundException(`Record with ID ${id} not found`);

      await repo.delete(id);

      return {
        success: true,
        message: 'Record deleted successfully',
        tenant: req.tenantConnection.options.database,
        deletedId: id,
      };
    } catch (error) {
      console.error('❌ Delete failed:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Failed to delete record');
    }
  }
}
