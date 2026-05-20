import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, ILike, Repository } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';
import { ReportingGroup } from './entities';
import { CreateReportingGroupDto, UpdateReportingGroupDto } from './dto';

@Injectable()
export class ReportingGroupsService extends TenantAbstractService<ReportingGroup> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(ReportingGroup));
  }

  protected getRepo(req: any): Repository<ReportingGroup> {
    return super.getRepo(req);
  }

  async create(req: any, dto: CreateReportingGroupDto) {
    const repo = this.getRepo(req);
    const name = dto.name.trim();
    const existing = await repo.findOne({ where: { name: ILike(name) } as any });

    if (existing) {
      throw new BadRequestException('A reporting group with this name already exists.');
    }

    const entity = repo.create({
      name,
      description: dto.description ?? null,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      createdBy: dto.createdBy ?? null,
      updatedBy: dto.updatedBy ?? null,
    });

    const saved = await repo.save(entity);

    return {
      success: true,
      message: 'Reporting group created successfully',
      tenant: req.tenantConnection.options.database,
      data: saved,
    };
  }

  async paginate(req: any, page = 1, relations: string[] = [], limit?: number) {
    return super.paginate(req, page, relations, limit);
  }

  async search(req: any, limit = 15, filters?: { name?: string; description?: string; isActive?: boolean }) {
    const repo = this.getRepo(req);
    const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);
    const qb = repo.createQueryBuilder('group');

    if (filters?.name) qb.andWhere('group.name ILIKE :name', { name: `%${filters.name.trim()}%` });
    if (filters?.description) qb.andWhere('group.description ILIKE :description', { description: `%${filters.description.trim()}%` });
    if (filters?.isActive !== undefined) qb.andWhere('group.is_active = :isActive', { isActive: filters.isActive });

    const [data, total] = await qb.orderBy('group.id', 'DESC').take(take).getManyAndCount();

    return {
      success: true,
      tenant: req.tenantConnection.options.database,
      meta: { total, page: 1, lastPage: Math.ceil(total / take) || 1 },
      data,
    };
  }

  async findOne(req: any, id: number) {
    return super.findOne(req, id, ['reportingCategories']);
  }

  async update(req: any, id: number, dto: UpdateReportingGroupDto) {
    const repo = this.getRepo(req);
    const entity = await repo.findOneBy({ id });

    if (!entity) {
      throw new NotFoundException(`Reporting group with ID ${id} not found`);
    }

    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.description !== undefined) entity.description = dto.description ?? null;
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    if (dto.createdBy !== undefined) entity.createdBy = dto.createdBy;
    if (dto.updatedBy !== undefined) entity.updatedBy = dto.updatedBy;

    const saved = await repo.save(entity);

    return {
      success: true,
      message: 'Reporting group updated successfully',
      tenant: req.tenantConnection.options.database,
      data: saved,
    };
  }
}