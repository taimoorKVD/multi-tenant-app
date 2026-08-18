import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, ILike, Repository } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';
import { ReportingCategory } from './entities';
import { ReportingGroup } from '../reporting-groups/entities';
import { Item } from '../items/entities';
import { AssignReportingCategoryItemsDto, CreateReportingCategoryDto, UpdateReportingCategoryDto } from './dto';

@Injectable()
export class ReportingCategoriesService extends TenantAbstractService<ReportingCategory> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(ReportingCategory));
  }

  protected getRepo(req: any): Repository<ReportingCategory> {
    return super.getRepo(req);
  }

  private getItemRepo(req: any): Repository<Item> {
    return req.tenantConnection.getRepository(Item);
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
    const resolvedRelations = relations.length ? relations : ['reportingGroup', 'items'];
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
    const qb = repo
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.reportingGroup', 'group')
      .leftJoinAndSelect('category.items', 'items');

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
    return super.findOne(req, id, ['reportingGroup', 'items']);
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

  async assignItems(req: any, categoryId: number, dto: AssignReportingCategoryItemsDto) {
    const repo = this.getRepo(req);
    const itemRepo = this.getItemRepo(req);
    const category = await repo.findOne({
      where: { id: categoryId } as any,
      relations: ['items'],
    });

    if (!category) {
      throw new NotFoundException(`Reporting category with ID ${categoryId} not found`);
    }

    const uniqueIds = [...new Set(dto.itemIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
    if (!uniqueIds.length) {
      throw new BadRequestException('At least one valid item ID is required');
    }

    const items = await itemRepo.findBy({ id: In(uniqueIds) });
    if (items.length !== uniqueIds.length) {
      const found = new Set(items.map((item) => item.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      throw new BadRequestException(`Item(s) not found: ${missing.join(', ')}`);
    }

    const existingIds = new Set((category.items || []).map((item) => item.id));
    const toAdd = items.filter((item) => !existingIds.has(item.id));
    category.items = [...(category.items || []), ...toAdd];
    const saved = await repo.save(category);

    return {
      success: true,
      message: 'Items assigned to reporting category successfully',
      tenant: req.tenantConnection.options.database,
      data: {
        id: saved.id,
        name: saved.name,
        assignedCount: toAdd.length,
        items: (saved.items || []).map((item) => ({
          id: item.id,
          itemName: item.itemName,
        })),
      },
    };
  }

  async removeItems(req: any, categoryId: number, dto: AssignReportingCategoryItemsDto) {
    const repo = this.getRepo(req);
    const category = await repo.findOne({
      where: { id: categoryId } as any,
      relations: ['items'],
    });

    if (!category) {
      throw new NotFoundException(`Reporting category with ID ${categoryId} not found`);
    }

    const removeIds = new Set(dto.itemIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)));
    if (!removeIds.size) {
      throw new BadRequestException('At least one valid item ID is required');
    }

    const before = category.items || [];
    const remaining = before.filter((item) => !removeIds.has(item.id));
    const removedCount = before.length - remaining.length;

    if (!removedCount) {
      throw new BadRequestException('None of the provided items are assigned to this category');
    }

    category.items = remaining;
    const saved = await repo.save(category);

    return {
      success: true,
      message: 'Items removed from reporting category successfully',
      tenant: req.tenantConnection.options.database,
      data: {
        id: saved.id,
        name: saved.name,
        removedCount,
        items: (saved.items || []).map((item) => ({
          id: item.id,
          itemName: item.itemName,
        })),
      },
    };
  }
}
