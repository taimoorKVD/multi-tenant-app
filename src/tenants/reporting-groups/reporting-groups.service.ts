import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, ILike, In, Repository } from 'typeorm';
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
    const resolvedRelations = relations.length
      ? relations
      : ['reportingCategories', 'reportingCategories.items'];
    return super.paginate(req, page, resolvedRelations, limit);
  }

  async search(req: any, limit = 15, filters?: { name?: string; description?: string; isActive?: boolean }) {
    const repo = this.getRepo(req);
    const parsedLimit = Number(limit);
    const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
    const qb = repo
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.reportingCategories', 'category')
      .leftJoinAndSelect('category.items', 'items');

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
    return super.findOne(req, id, ['reportingCategories', 'reportingCategories.items']);
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

  private assertGroupCanBeDeleted(group: ReportingGroup): void {
    const categories = group.reportingCategories || [];
    if (!categories.length) {
      return;
    }

    const categoriesWithItems = categories.filter((category) => (category.items || []).length > 0);
    if (categoriesWithItems.length) {
      const details = categoriesWithItems
        .map((category) => `"${category.name}" (${category.items.length} item(s))`)
        .join(', ');
      throw new BadRequestException(
        `Cannot delete reporting group "${group.name}" because the following categor${categoriesWithItems.length === 1 ? 'y has' : 'ies have'} assigned items: ${details}. Remove all items from categories first.`,
      );
    }

    throw new BadRequestException(
      `Cannot delete reporting group "${group.name}" because it has ${categories.length} reporting categor${categories.length === 1 ? 'y' : 'ies'}. Delete all categories first.`,
    );
  }

  async delete(req: any, id: number) {
    const repo = this.getRepo(req);
    const group = await repo.findOne({
      where: { id } as any,
      relations: ['reportingCategories', 'reportingCategories.items'],
    });

    if (!group) {
      throw new NotFoundException(`Reporting group with ID ${id} not found`);
    }

    this.assertGroupCanBeDeleted(group);

    return super.delete(req, id);
  }

  async bulkDelete(req: any, ids: number[]) {
    const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
    if (!uniqueIds.length) {
      throw new BadRequestException('At least one valid ID is required');
    }

    const repo = this.getRepo(req);
    const groups = await repo.find({
      where: { id: In(uniqueIds) } as any,
      relations: ['reportingCategories', 'reportingCategories.items'],
    });

    const foundIds = groups.map((group) => group.id);
    const missingIds = uniqueIds.filter((id) => !foundIds.includes(id));
    if (missingIds.length) {
      throw new NotFoundException(`Records not found for IDs: ${missingIds.join(', ')}`);
    }

    for (const group of groups) {
      this.assertGroupCanBeDeleted(group);
    }

    return super.bulkDelete(req, uniqueIds);
  }
}
