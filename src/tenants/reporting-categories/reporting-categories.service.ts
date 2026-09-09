import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, ILike, Repository } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';
import { ReportingCategory } from './entities';
import { ReportingGroup } from '../reporting-groups/entities';
import { Item } from '../items/entities';
import { AssignReportingCategoryItemsDto, CreateReportingCategoryDto, UpdateReportingCategoryDto } from './dto';
import { DynamicFieldsService } from '../form-builder/services';

@Injectable()
export class ReportingCategoriesService extends TenantAbstractService<ReportingCategory> {
  private readonly itemsModuleSlug = 'items';
  private readonly itemsFallbackSystemFieldKeys = new Set([
    'id',
    'item_name',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by',
  ]);

  constructor(
    private readonly dataSource: DataSource,
    private readonly dynamicFields: DynamicFieldsService,
  ) {
    super(dataSource.getRepository(ReportingCategory));
  }

  protected getRepo(req: any): Repository<ReportingCategory> {
    return super.getRepo(req);
  }

  private getItemRepo(req: any): Repository<Item> {
    return req.tenantConnection.getRepository(Item);
  }

  private getActorId(req: any): number | null {
    const candidate = req?.user?.id ?? req?.user?.sub ?? req?.user?.userId ?? null;
    if (candidate === null || candidate === undefined) return null;
    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  /**
   * Keep the item form field `reporting_group` in sync with M2M assignments.
   * Pass `preferredCategoryId` after assign-from-category; omit after remove to derive from remaining links.
   */
  private async syncItemsReportingGroupField(
    req: any,
    itemIds: number[],
    preferredCategoryId?: number | null,
  ): Promise<void> {
    const uniqueIds = [...new Set(itemIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
    if (!uniqueIds.length) return;

    const context = await this.dynamicFields.getSchemaContext(req, this.itemsModuleSlug, {
      fallbackSystemFieldKeys: this.itemsFallbackSystemFieldKeys,
    });
    if (!context.moduleId) return;

    const fieldId =
      context.fieldIdByCanonicalKey.get('reporting_group') ||
      this.dynamicFields.resolveFieldIdForDataKey(context, 'reporting_group');
    if (!fieldId) return;

    const actor = this.getActorId(req);
    const itemRepo = this.getItemRepo(req);
    const items = await itemRepo.find({
      where: { id: In(uniqueIds) } as any,
      relations: ['reportingCategories'],
    });

    for (const item of items) {
      const remainingIds = (item.reportingCategories || []).map((category) => category.id);
      let nextValue: number | null;
      if (preferredCategoryId !== undefined) {
        nextValue = preferredCategoryId;
      } else if (remainingIds.length) {
        nextValue = remainingIds[0];
      } else {
        nextValue = null;
      }

      const existing = await this.dynamicFields.loadDynamicRow(req, context.moduleId, item.id, context);
      const nextData = { ...existing };
      if (nextValue === null) {
        delete nextData[fieldId];
        delete nextData.reporting_group;
      } else {
        nextData[fieldId] = nextValue;
      }

      await this.dynamicFields.upsertDynamicRow(
        req,
        context.moduleId,
        item.id,
        context.activeVersionId,
        nextData,
        actor,
        context,
      );
    }
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

    if (toAdd.length) {
      await this.syncItemsReportingGroupField(
        req,
        toAdd.map((item) => item.id),
        categoryId,
      );
    }

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
    const removedIds = before.filter((item) => removeIds.has(item.id)).map((item) => item.id);
    const removedCount = removedIds.length;

    if (!removedCount) {
      throw new BadRequestException('None of the provided items are assigned to this category');
    }

    category.items = remaining;
    const saved = await repo.save(category);

    await this.syncItemsReportingGroupField(req, removedIds);

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

  async delete(req: any, id: number) {
    const repo = this.getRepo(req);
    const category = await repo.findOne({
      where: { id } as any,
      relations: ['items'],
    });

    if (!category) {
      throw new NotFoundException(`Reporting category with ID ${id} not found`);
    }

    const itemCount = category.items?.length ?? 0;
    if (itemCount > 0) {
      throw new BadRequestException(
        `Cannot delete reporting category "${category.name}" because it has ${itemCount} assigned item(s). Remove all items from the category first.`,
      );
    }

    return super.delete(req, id);
  }

  async bulkDelete(req: any, ids: number[]) {
    const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
    if (!uniqueIds.length) {
      throw new BadRequestException('At least one valid ID is required');
    }

    const repo = this.getRepo(req);
    const categories = await repo.find({
      where: { id: In(uniqueIds) } as any,
      relations: ['items'],
    });

    const foundIds = categories.map((category) => category.id);
    const missingIds = uniqueIds.filter((id) => !foundIds.includes(id));
    if (missingIds.length) {
      throw new NotFoundException(`Records not found for IDs: ${missingIds.join(', ')}`);
    }

    const withItems = categories.filter((category) => (category.items || []).length > 0);
    if (withItems.length) {
      const details = withItems
        .map((category) => `"${category.name}" (${category.items.length} item(s))`)
        .join(', ');
      throw new BadRequestException(
        `Cannot delete reporting categor${withItems.length === 1 ? 'y' : 'ies'} with assigned items: ${details}. Remove all items first.`,
      );
    }

    return super.bulkDelete(req, uniqueIds);
  }
}
