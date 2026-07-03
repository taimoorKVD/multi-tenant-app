import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';
import { CreateItemDto, UpdateItemDto } from './dto';
import { Item } from './entities';
// import { ILike, In } from 'typeorm';
// import { Vendor } from '../vendors/entities';
// import { ReportingCategory } from '../reporting-categories/entities';

@Injectable()
export class ItemsService extends TenantAbstractService<Item> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(Item));
  }

  protected getRepo(req: any): Repository<Item> {
    return super.getRepo(req);
  }

  // private async resolveReportingCategories(req: any, ids?: number[]) {
  //   if (!ids?.length) return [];

  //   const categoryRepo = req.tenantConnection.getRepository(ReportingCategory);
  //   const categories = await categoryRepo.find({ where: { id: In(ids) } });

  //   if (categories.length !== ids.length) {
  //     throw new BadRequestException('One or more reportingCategoryIds are invalid.');
  //   }

  //   return categories;
  // }

  // private async resolveVendor(req: any, vendorId?: number | null) {
  //   if (vendorId === undefined || vendorId === null) return null;

  //   const vendorRepo = req.tenantConnection.getRepository(Vendor);
  //   const vendor = await vendorRepo.findOneBy({ id: vendorId });
  //   if (!vendor) {
  //     throw new BadRequestException(`Vendor with ID ${vendorId} not found.`);
  //   }

  //   return vendor;
  // }

  async create(req: any, dto: CreateItemDto) {
    const repo = this.getRepo(req);
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Name is required.');
    }

    const entity = repo.create({
      name,
      createdBy: dto.createdBy ?? null,
      updatedBy: dto.updatedBy ?? null,
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
    return super.paginate(req, page, relations, limit);
  }

  async search(req: any, limit = 15, filters?: { name?: string }) {
    const repo = this.getRepo(req);
    const parsedLimit = Number(limit);
    const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
    const qb = repo.createQueryBuilder('item');

    if (filters?.name) qb.andWhere('item.name ILIKE :name', { name: `%${filters.name.trim()}%` });

    const [data, total] = await qb.orderBy('item.id', 'DESC').take(take).getManyAndCount();

    return {
      success: true,
      tenant: req.tenantConnection.options.database,
      meta: { total, page: 1, lastPage: Math.ceil(total / take) || 1 },
      data,
    };
  }

  async findOne(req: any, id: number) {
    return super.findOne(req, id);
  }

  async update(req: any, id: number, dto: UpdateItemDto) {
    const repo = this.getRepo(req);
    const entity = await repo.findOne({ where: { id } as any });

    if (!entity) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }

    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.createdBy !== undefined) entity.createdBy = dto.createdBy;
    if (dto.updatedBy !== undefined) entity.updatedBy = dto.updatedBy;

    const saved = await repo.save(entity);

    return {
      success: true,
      message: 'Item updated successfully',
      tenant: req.tenantConnection.options.database,
      data: saved,
    };
  }
}
