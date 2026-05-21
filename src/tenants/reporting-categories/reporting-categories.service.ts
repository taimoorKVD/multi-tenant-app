import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, ILike, Repository } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';
import { ReportingCategory } from './entities';
import { ReportingGroup } from '../reporting-groups/entities';
import { CreateReportingCategoryDto, UpdateReportingCategoryDto } from './dto';

@Injectable()
export class ReportingCategoriesService extends TenantAbstractService<ReportingCategory> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(ReportingCategory));
  }

  protected getRepo(req: any): Repository<ReportingCategory> {
    return super.getRepo(req);
  }

  async create(req: any, dto: CreateReportingCategoryDto) {
    const repo = this.getRepo(req);
    const groupRepo = req.tenantConnection.getRepository(ReportingGroup);
    const group = await groupRepo.findOneBy({ id: dto.reportingGroupId });

    if (!group) {
      throw new BadRequestException(`Reporting group with ID ${dto.reportingGroupId} not found.`);
    }

    const name = dto.name.trim();
    const existing = await repo.findOne({ where: { name: ILike(name) } as any });
    if (existing) {
      throw new BadRequestException('A reporting category with this name already exists.');
    }

    const entity = repo.create({
      reportingGroupId: group.id,
      name,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      createdBy: dto.createdBy ?? null,
      updatedBy: dto.updatedBy ?? null,
    });

    const saved = await repo.save(entity);

    return {
      success: true,
      message: 'Reporting category created successfully',
      tenant: req.tenantConnection.options.database,
      data: saved,
    };
  }

  async paginate(req: any, page = 1, relations: string[] = [], limit?: number) {
    const resolvedRelations = relations.length ? relations : ['reportingGroup'];
    return super.paginate(req, page, resolvedRelations, limit);
  }

  async search(
    req: any,
    limit = 15,
    filters?: { reportingGroupId?: number; name?: string; description?: string; isActive?: string },
  ) {
    const repo = this.getRepo(req);
    const parsedLimit = Number(limit);
    const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
    const qb = repo.createQueryBuilder('category').leftJoinAndSelect('category.reportingGroup', 'group');

    if (filters?.reportingGroupId) qb.andWhere('category.reportingGroupId = :groupId', { groupId: filters.reportingGroupId });
    if (filters?.name) qb.andWhere('category.name ILIKE :name', { name: `%${filters.name.trim()}%` });
    if (filters?.description) qb.andWhere('category.description ILIKE :description', { description: `%${filters.description.trim()}%` });
    if (filters?.isActive !== undefined) qb.andWhere('category.isActive = :isActive', { isActive: filters.isActive });

    const [data, total] = await qb.orderBy('category.id', 'DESC').take(take).getManyAndCount();

    return {
      success: true,
      tenant: req.tenantConnection.options.database,
      meta: { total, page: 1, lastPage: Math.ceil(total / take) || 1 },
      data,
    };
  }

  async findOne(req: any, id: number) {
    return super.findOne(req, id, ['reportingGroup']);
  }

  async update(req: any, id: number, dto: UpdateReportingCategoryDto) {
    const repo = this.getRepo(req);
    const groupRepo = req.tenantConnection.getRepository(ReportingGroup);
    const entity = await repo.findOneBy({ id });

    if (!entity) {
      throw new NotFoundException(`Reporting category with ID ${id} not found`);
    }

    if (dto.reportingGroupId !== undefined) {
      const group = await groupRepo.findOneBy({ id: dto.reportingGroupId });
      if (!group) {
        throw new BadRequestException(`Reporting group with ID ${dto.reportingGroupId} not found.`);
      }
      entity.reportingGroupId = group.id;
    }

    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.description !== undefined) entity.description = dto.description ?? null;
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    if (dto.createdBy !== undefined) entity.createdBy = dto.createdBy;
    if (dto.updatedBy !== undefined) entity.updatedBy = dto.updatedBy;

    const saved = await repo.save(entity);

    return {
      success: true,
      message: 'Reporting category updated successfully',
      tenant: req.tenantConnection.options.database,
      data: saved,
    };
  }
}
