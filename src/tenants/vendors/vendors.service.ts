import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';
import { DynamicFieldsService, DynamicSchemaContext } from '../form-builder/services';
import { Vendor } from './entities';

@Injectable()
export class VendorsService extends TenantAbstractService<Vendor> {
  private readonly moduleSlug = 'vendors';

  private readonly fallbackSystemFieldKeys = new Set([
    'id',
    'vendor_name',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by',
  ]);

  private readonly ignoredPayloadKeys = new Set([
    'id',
    'createdBy',
    'updatedBy',
    'created_by',
    'updated_by',
    'created_at',
    'updated_at',
    'limit',
  ]);

  constructor(
    private readonly dataSource: DataSource,
    private readonly dynamicFields: DynamicFieldsService,
  ) {
    super(dataSource.getRepository(Vendor));
  }

  protected getRepo(req: any): Repository<Vendor> {
    return super.getRepo(req);
  }

  private getActorId(req: any): number | null {
    const candidate = req?.user?.id ?? req?.user?.sub ?? req?.user?.userId ?? null;
    if (candidate === null || candidate === undefined) return null;
    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  private getContext(req: any): Promise<DynamicSchemaContext> {
    return this.dynamicFields.getSchemaContext(req, this.moduleSlug, {
      fallbackSystemFieldKeys: this.fallbackSystemFieldKeys,
    });
  }

  private isEmptyRequiredValue(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    return false;
  }

  private assertCreatePayloadRequiredFields(
    payload: Record<string, any>,
    requiredFieldKeys: Set<string>,
    context: DynamicSchemaContext,
    fieldLabels: Map<string, string> = new Map(),
  ): void {
    const missing = Array.from(requiredFieldKeys).filter((key) => {
      const storageKey = this.dynamicFields.resolvePayloadCanonicalKey(
        context,
        context.aliasToCanonicalMap,
        key,
      );
      const value = payload[storageKey] ?? payload[key];
      return this.isEmptyRequiredValue(value);
    });

    if (!missing.length) return;

    throw new BadRequestException({
      message: missing.map((key) => `${fieldLabels.get(key) || key} is required.`),
      error: 'Bad Request',
      statusCode: 400,
      fields: missing.reduce(
        (acc, key) => ({
          ...acc,
          [key]: `${fieldLabels.get(key) || key} is required.`,
        }),
        {} as Record<string, string>,
      ),
    });
  }

  private applyStaticPayloadToVendor(
    vendor: Vendor,
    staticPayload: Record<string, any>,
    isCreate: boolean,
  ): void {
    if (
      staticPayload.vendor_name !== undefined &&
      (isCreate || this.dynamicFields.hasPresentValue(staticPayload.vendor_name))
    ) {
      vendor.vendorName = String(staticPayload.vendor_name).trim();
    }
  }

  private buildVendorResponse(
    vendor: Vendor,
    dynamicData: Record<string, any>,
    context: DynamicSchemaContext,
  ): Record<string, any> {
    return this.dynamicFields.buildResponse(
      context,
      { vendor_name: vendor.vendorName },
      dynamicData,
      {
        id: vendor.id,
        created_by: vendor.createdBy,
        updated_by: vendor.updatedBy,
        created_at: vendor.createdAt,
        updated_at: vendor.updatedAt,
      },
    );
  }

  async create(req: any, body: Record<string, any>): Promise<any> {
    try {
      const context = await this.getContext(req);
      const repo = this.getRepo(req);
      const actor = this.getActorId(req);

      const normalized = this.dynamicFields.resolvePayloadAliases(body, context.aliasToCanonicalMap, context);
      this.assertCreatePayloadRequiredFields(
        normalized,
        context.requiredFieldKeys,
        context,
        context.fieldLabels,
      );

      let { staticPayload, dynamicPayload } = this.dynamicFields.splitPayload(
        normalized,
        context.systemFieldKeys,
        this.ignoredPayloadKeys,
      );
      ({ staticPayload, dynamicPayload } = this.dynamicFields.promoteDynamicSystemFields(
        staticPayload,
        dynamicPayload,
        context.aliasToCanonicalMap,
        context.systemFieldKeys,
        context,
      ));

      const entity = repo.create({
        createdBy: this.coerceId(body.createdBy) ?? actor,
        updatedBy: this.coerceId(body.updatedBy) ?? actor,
      });
      this.applyStaticPayloadToVendor(entity, staticPayload, true);
      const saved = await repo.save(entity);

      await this.dynamicFields.upsertDynamicRow(
        req,
        context.moduleId,
        saved.id,
        context.activeVersionId,
        dynamicPayload,
        actor,
        context,
      );

      const dynamicData = await this.dynamicFields.loadDynamicRow(req, context.moduleId, saved.id, context);

      return {
        success: true,
        message: 'Vendor created successfully',
        tenant: req.tenantConnection.options.database,
        data: this.buildVendorResponse(saved, dynamicData, context),
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error('Vendor creation failed:', error);
      throw new InternalServerErrorException(`Failed to create vendor: ${(error as Error).message}`);
    }
  }

  async update(req: any, id: number, body: Record<string, any>): Promise<any> {
    try {
      const context = await this.getContext(req);
      const repo = this.getRepo(req);
      const actor = this.getActorId(req);

      const entity = await repo.findOne({ where: { id } as any });
      if (!entity) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      const normalized = this.dynamicFields.resolvePayloadAliases(body, context.aliasToCanonicalMap, context);
      let { staticPayload, dynamicPayload } = this.dynamicFields.splitPayload(
        normalized,
        context.systemFieldKeys,
        this.ignoredPayloadKeys,
      );
      ({ staticPayload, dynamicPayload } = this.dynamicFields.promoteDynamicSystemFields(
        staticPayload,
        dynamicPayload,
        context.aliasToCanonicalMap,
        context.systemFieldKeys,
        context,
      ));

      this.applyStaticPayloadToVendor(entity, staticPayload, false);
      const updatedBy = this.coerceId(body.updatedBy) ?? actor;
      if (updatedBy !== null) entity.updatedBy = updatedBy;

      const saved = await repo.save(entity);

      if (Object.keys(dynamicPayload).length) {
        const existing = await this.dynamicFields.loadDynamicRow(req, context.moduleId, saved.id, context);
        await this.dynamicFields.upsertDynamicRow(
          req,
          context.moduleId,
          saved.id,
          context.activeVersionId,
          { ...existing, ...dynamicPayload },
          actor,
          context,
        );
      }

      const dynamicData = await this.dynamicFields.loadDynamicRow(req, context.moduleId, saved.id, context);

      return {
        success: true,
        message: 'Vendor updated successfully',
        tenant: req.tenantConnection.options.database,
        data: this.buildVendorResponse(saved, dynamicData, context),
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      console.error('Vendor update failed:', error);
      throw new InternalServerErrorException(`Failed to update vendor: ${(error as Error).message}`);
    }
  }

  async paginate(req: any, page = 1, relations: string[] = [], limit?: number): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const parsedLimit = limit !== undefined ? Number(limit) : undefined;
      const currentPage = Math.max(Number(page) || 1, 1);
      const queryOptions: any = { order: { id: 'DESC' } as any };

      if (parsedLimit && parsedLimit > 0) {
        queryOptions.take = Math.min(Math.max(parsedLimit, 1), 100);
        queryOptions.skip = (currentPage - 1) * queryOptions.take;
      }

      const [data, total] = await repo.findAndCount(queryOptions);
      const context = await this.getContext(req);
      const dynamicRows = await this.dynamicFields.loadDynamicRows(
        req,
        context.moduleId,
        data.map((vendor) => vendor.id),
        context,
      );

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        meta: {
          total,
          page: currentPage,
          lastPage: queryOptions.take ? Math.ceil(total / queryOptions.take) || 1 : 1,
        },
        data: data.map((vendor) =>
          this.buildVendorResponse(vendor, dynamicRows.get(vendor.id) || {}, context),
        ),
      };
    } catch (error) {
      console.error('Vendor pagination failed:', error);
      throw new InternalServerErrorException('Failed to paginate vendors');
    }
  }

  async findOne(req: any, id: number): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const entity = await repo.findOne({ where: { id } as any });
      if (!entity) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      const context = await this.getContext(req);
      const dynamicData = await this.dynamicFields.loadDynamicRow(req, context.moduleId, entity.id, context);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        data: this.buildVendorResponse(entity, dynamicData, context),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Vendor findOne failed:', error);
      throw new InternalServerErrorException('Failed to retrieve vendor');
    }
  }

  async search(req: any, limit = 15, filters?: Record<string, any>): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const parsedLimit = Number(limit);
      const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;

      const rawFilters = Object.entries(filters || {}).reduce((acc, [key, value]) => {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey || this.ignoredPayloadKeys.has(normalizedKey)) return acc;
        const normalizedValue =
          typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value);
        if (!normalizedValue) return acc;
        acc[normalizedKey] = normalizedValue;
        return acc;
      }, {} as Record<string, string>);

      if (!Object.keys(rawFilters).length) {
        return { success: true, tenant: req.tenantConnection.options.database, count: 0, data: [] };
      }

      const context = await this.getContext(req);
      const qb = repo.createQueryBuilder('vendor');

      const trueDynamicFilters: Record<string, string> = {};
      for (const [key, value] of Object.entries(rawFilters)) {
        const canonicalKey = this.dynamicFields.resolveCanonicalKey(context, key);
        if (canonicalKey === 'vendor_name') {
          qb.andWhere('vendor.vendorName ILIKE :vendor_name', { vendor_name: `%${value}%` });
        } else {
          trueDynamicFilters[key] = value;
        }
      }

      const matchedIds = await this.dynamicFields.findDynamicMatchedIds(req, context, trueDynamicFilters);
      if (matchedIds !== null) {
        if (!matchedIds.length) {
          return { success: true, tenant: req.tenantConnection.options.database, count: 0, data: [] };
        }
        qb.andWhere('vendor.id IN (:...dynamicIds)', { dynamicIds: matchedIds });
      }

      const vendors = await qb.orderBy('vendor.id', 'DESC').take(take).getMany();
      const dynamicRows = await this.dynamicFields.loadDynamicRows(
        req,
        context.moduleId,
        vendors.map((vendor) => vendor.id),
        context,
      );

      const data = vendors.map((vendor) =>
        this.buildVendorResponse(vendor, dynamicRows.get(vendor.id) || {}, context),
      );

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data,
      };
    } catch (error) {
      console.error('Vendor search failed:', error);
      throw new InternalServerErrorException(`Failed to search vendors: ${(error as Error).message}`);
    }
  }

  async delete(req: any, id: number): Promise<any> {
    const context = await this.getContext(req);
    const result = await super.delete(req, id);
    await this.dynamicFields.deleteDynamicRow(req, context.moduleId, id);
    return result;
  }

  async bulkDelete(req: any, ids: number[]): Promise<any> {
    const context = await this.getContext(req);
    const result = await super.bulkDelete(req, ids);
    for (const id of result.data.deletedIds as number[]) {
      await this.dynamicFields.deleteDynamicRow(req, context.moduleId, id);
    }
    return result;
  }

  private coerceId(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
}
