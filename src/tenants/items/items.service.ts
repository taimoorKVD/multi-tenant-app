import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';
import { CreateItemDto, UpdateItemDto } from './dto';
import { Item } from './entities';
import { Vendor } from '../vendors/entities';
import { ReportingCategory } from '../reporting-categories/entities';

@Injectable()
export class ItemsService extends TenantAbstractService<Item> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(Item));
  }

  protected getRepo(req: any): Repository<Item> {
    return super.getRepo(req);
  }

  private async resolveReportingCategories(req: any, ids?: number[]) {
    if (!ids?.length) return [];

    const categoryRepo = req.tenantConnection.getRepository(ReportingCategory);
    const categories = await categoryRepo.find({ where: { id: In(ids) } });

    if (categories.length !== ids.length) {
      throw new BadRequestException('One or more reportingCategoryIds are invalid.');
    }

    return categories;
  }

  private async resolveVendor(req: any, vendorId?: number | null) {
    if (vendorId === undefined || vendorId === null) return null;

    const vendorRepo = req.tenantConnection.getRepository(Vendor);
    const vendor = await vendorRepo.findOneBy({ id: vendorId });
    if (!vendor) {
      throw new BadRequestException(`Vendor with ID ${vendorId} not found.`);
    }

    return vendor;
  }

  async create(req: any, dto: CreateItemDto) {
    const repo = this.getRepo(req);
    const itemNo = dto.itemNo.trim();
    const existing = await repo.findOne({ where: { itemNo: ILike(itemNo) } as any });

    if (existing) {
      throw new BadRequestException('An item with this item number already exists.');
    }

    const vendor = await this.resolveVendor(req, dto.vendorId ?? null);
    const reportingCategories = await this.resolveReportingCategories(req, dto.reportingCategoryIds);

    const entity = repo.create({
      itemNo,
      name: dto.name.trim(),
      description: dto.description ?? null,
      size: dto.size ?? null,
      cost: dto.cost,
      par: dto.par ?? null,
      vendorId: vendor?.id ?? null,
      vendor,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      createdBy: dto.createdBy ?? null,
      updatedBy: dto.updatedBy ?? null,
      reportingCategories,
    });

    const saved = await repo.save(entity);

    return {
      success: true,
      message: 'Item created successfully',
      tenant: req.tenantConnection.options.database,
      data: saved,
    };
  }

  async paginate(req: any, page = 1, relations: string[] = [], limit?: number) {
    const resolvedRelations = relations.length ? relations : ['vendor', 'reportingCategories'];
    return super.paginate(req, page, resolvedRelations, limit);
  }

  async search(
    req: any,
    limit = 15,
    filters?: {
      itemNo?: string;
      name?: string;
      isActive?: boolean;
      vendorId?: number;
      reportingCategoryIds?: number[];
    },
  ) {
    const repo = this.getRepo(req);
    const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);
    const qb = repo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.vendor', 'vendor')
      .leftJoinAndSelect('item.reportingCategories', 'category')
      .distinct(true);

    if (filters?.itemNo) qb.andWhere('item.item_no ILIKE :itemNo', { itemNo: `%${filters.itemNo.trim()}%` });
    if (filters?.name) qb.andWhere('item.name ILIKE :name', { name: `%${filters.name.trim()}%` });
    if (filters?.isActive !== undefined) qb.andWhere('item.isActive = :isActive', { isActive: filters.isActive });
    if (filters?.vendorId) qb.andWhere('item.vendor_id = :vendorId', { vendorId: filters.vendorId });
    if (filters?.reportingCategoryIds && filters.reportingCategoryIds.length > 0) {
      qb.andWhere('category.id IN (:...categoryIds)', { categoryIds: filters.reportingCategoryIds });
    }

    const [data, total] = await qb.orderBy('item.id', 'DESC').take(take).getManyAndCount();

    return {
      success: true,
      tenant: req.tenantConnection.options.database,
      meta: { total, page: 1, lastPage: Math.ceil(total / take) || 1 },
      data,
    };
  }

  async findOne(req: any, id: number) {
    return super.findOne(req, id, ['vendor', 'reportingCategories']);
  }

  async update(req: any, id: number, dto: UpdateItemDto) {
    const repo = this.getRepo(req);
    const entity = await repo.findOne({ where: { id } as any, relations: ['vendor', 'reportingCategories'] });

    if (!entity) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }

    if (dto.itemNo !== undefined) {
      const itemNo = dto.itemNo.trim();
      if (itemNo !== entity.itemNo) {
        const duplicate = await repo.findOne({ where: { itemNo: ILike(itemNo) } as any });
        if (duplicate && duplicate.id !== id) {
          throw new BadRequestException('An item with this item number already exists.');
        }
      }
      entity.itemNo = itemNo;
    }

    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.description !== undefined) entity.description = dto.description ?? null;
    if (dto.size !== undefined) entity.size = dto.size ?? null;
    if (dto.cost !== undefined) entity.cost = dto.cost;
    if (dto.par !== undefined) entity.par = dto.par ?? null;
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    if (dto.createdBy !== undefined) entity.createdBy = dto.createdBy;
    if (dto.updatedBy !== undefined) entity.updatedBy = dto.updatedBy;

    if (dto.vendorId !== undefined) {
      const vendor = await this.resolveVendor(req, dto.vendorId);
      entity.vendorId = vendor?.id ?? null;
      entity.vendor = vendor;
    }

    if (dto.reportingCategoryIds !== undefined) {
      entity.reportingCategories = await this.resolveReportingCategories(req, dto.reportingCategoryIds);
    }

    const saved = await repo.save(entity);

    return {
      success: true,
      message: 'Item updated successfully',
      tenant: req.tenantConnection.options.database,
      data: saved,
    };
  }
}