import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Location } from './entities';
import { TenantAbstractService } from '../../common/abstract';
import { DynamicFieldsService, DynamicSchemaContext } from '../form-builder/services';

@Injectable()
export class LocationsService extends TenantAbstractService<Location> {
  private readonly moduleSlug = 'locations';

  private readonly fallbackSystemFieldKeys = new Set([
    'id',
    'name',
    'address',
    'country_id',
    'state_id',
    'city_id',
    'postalCode',
    'latitude',
    'longitude',
    'created_at',
    'updated_at',
  ]);

  private readonly ignoredPayloadKeys = new Set([
    'id',
    'created_at',
    'updated_at',
    'createdBy',
    'updatedBy',
    'limit',
  ]);

  // canonical field key -> Location entity property
  private readonly stringColumns: Record<string, keyof Location> = {
    name: 'name',
    address: 'address',
    postalCode: 'postalCode',
    latitude: 'latitude',
    longitude: 'longitude',
  };

  private readonly intColumns: Record<string, keyof Location> = {
    country_id: 'countryId',
    state_id: 'stateId',
    city_id: 'cityId',
  };

  constructor(
    private readonly dataSource: DataSource,
    private readonly dynamicFields: DynamicFieldsService,
  ) {
    super(dataSource.getRepository(Location));
  }

  protected getRepo(req: any): Repository<Location> {
    return super.getRepo(req);
  }

  private getContext(req: any): Promise<DynamicSchemaContext> {
    return this.dynamicFields.getSchemaContext(req, this.moduleSlug, {
      fallbackSystemFieldKeys: this.fallbackSystemFieldKeys,
    });
  }

  private coerceId(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
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
    fieldLabels: Map<string, string> = new Map(),
  ): void {
    const missing = Array.from(requiredFieldKeys).filter((key) =>
      this.isEmptyRequiredValue(payload[key]),
    );

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

  private getActorId(req: any): number | null {
    const candidate = req?.user?.id ?? req?.user?.sub ?? req?.user?.userId ?? null;
    if (candidate === null || candidate === undefined) return null;
    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  private applyStaticPayload(entity: Location, staticPayload: Record<string, any>, isCreate: boolean): void {
    for (const [canonicalKey, prop] of Object.entries(this.stringColumns)) {
      if (!(canonicalKey in staticPayload)) continue;
      const value = staticPayload[canonicalKey];
      if (isCreate || this.dynamicFields.hasPresentValue(value)) {
        (entity as any)[prop] = value === null || value === undefined ? value : String(value).trim();
      }
    }

    for (const [canonicalKey, prop] of Object.entries(this.intColumns)) {
      if (!(canonicalKey in staticPayload)) continue;
      (entity as any)[prop] = this.coerceId(staticPayload[canonicalKey]);
    }
  }

  private buildLocationResponse(
    location: Location,
    dynamicData: Record<string, any>,
    context: DynamicSchemaContext,
  ): Record<string, any> {
    return this.dynamicFields.buildResponse(
      context,
      {
        name: location.name,
        address: location.address,
        country_id: location.countryId ?? null,
        state_id: location.stateId ?? null,
        city_id: location.cityId ?? null,
        postalCode: location.postalCode,
        latitude: location.latitude,
        longitude: location.longitude,
      },
      dynamicData,
      {
        id: location.id,
        created_at: location.createdAt,
        updated_at: location.updatedAt,
      },
    );
  }

  async create(req: any, body: Record<string, any>): Promise<any> {
    try {
      const context = await this.getContext(req);
      const repo = this.getRepo(req);
      const actor = this.getActorId(req);

      const normalized = this.dynamicFields.resolvePayloadAliases(body, context.aliasToCanonicalMap, context);
      this.assertCreatePayloadRequiredFields(normalized, context.requiredFieldKeys, context.fieldLabels);

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

      const entity = repo.create();
      this.applyStaticPayload(entity, staticPayload, true);
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
        message: 'Location created successfully',
        tenant: req.tenantConnection.options.database,
        data: this.buildLocationResponse(saved, dynamicData, context),
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error('Location creation failed:', error);
      throw new InternalServerErrorException(`Failed to create location: ${(error as Error).message}`);
    }
  }

  async update(req: any, id: number, body: Record<string, any>): Promise<any> {
    try {
      const context = await this.getContext(req);
      const repo = this.getRepo(req);
      const actor = this.getActorId(req);

      const entity = await repo.findOne({ where: { id } as any });
      if (!entity) {
        throw new NotFoundException(`Location with ID ${id} not found`);
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

      this.applyStaticPayload(entity, staticPayload, false);
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
        message: 'Location updated successfully',
        tenant: req.tenantConnection.options.database,
        data: this.buildLocationResponse(saved, dynamicData, context),
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      console.error('Location update failed:', error);
      throw new InternalServerErrorException(`Failed to update location: ${(error as Error).message}`);
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
        data.map((location) => location.id),
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
        data: data.map((location) =>
          this.buildLocationResponse(location, dynamicRows.get(location.id) || {}, context),
        ),
      };
    } catch (error) {
      console.error('Location pagination failed:', error);
      throw new InternalServerErrorException('Failed to paginate locations');
    }
  }

  async findOne(req: any, id: number): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const entity = await repo.findOne({ where: { id } as any });
      if (!entity) {
        throw new NotFoundException(`Location with ID ${id} not found`);
      }

      const context = await this.getContext(req);
      const dynamicData = await this.dynamicFields.loadDynamicRow(req, context.moduleId, entity.id, context);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        data: this.buildLocationResponse(entity, dynamicData, context),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Location findOne failed:', error);
      throw new InternalServerErrorException('Failed to retrieve location');
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
      const qb = repo.createQueryBuilder('location');

      const trueDynamicFilters: Record<string, string> = {};
      for (const [key, value] of Object.entries(rawFilters)) {
        const canonicalKey = this.dynamicFields.resolveCanonicalKey(context, key);

        if (this.stringColumns[canonicalKey]) {
          const prop = this.stringColumns[canonicalKey];
          qb.andWhere(`location.${String(prop)} ILIKE :s_${canonicalKey}`, { [`s_${canonicalKey}`]: `%${value}%` });
        } else if (this.intColumns[canonicalKey]) {
          const prop = this.intColumns[canonicalKey];
          const parsed = this.coerceId(value);
          if (parsed !== null) {
            qb.andWhere(`location.${String(prop)} = :i_${canonicalKey}`, { [`i_${canonicalKey}`]: parsed });
          }
        } else {
          trueDynamicFilters[key] = value;
        }
      }

      const matchedIds = await this.dynamicFields.findDynamicMatchedIds(req, context, trueDynamicFilters);
      if (matchedIds !== null) {
        if (!matchedIds.length) {
          return { success: true, tenant: req.tenantConnection.options.database, count: 0, data: [] };
        }
        qb.andWhere('location.id IN (:...dynamicIds)', { dynamicIds: matchedIds });
      }

      const locations = await qb.orderBy('location.id', 'DESC').take(take).getMany();
      const dynamicRows = await this.dynamicFields.loadDynamicRows(
        req,
        context.moduleId,
        locations.map((location) => location.id),
        context,
      );

      const data = locations.map((location) =>
        this.buildLocationResponse(location, dynamicRows.get(location.id) || {}, context),
      );

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data,
      };
    } catch (error) {
      console.error('Tenant location search failed:', error);
      throw new InternalServerErrorException(`Failed to search tenant locations: ${(error as Error).message}`);
    }
  }

  async delete(req: any, id: number): Promise<any> {
    const context = await this.getContext(req);
    const result = await super.delete(req, id);
    await this.dynamicFields.deleteDynamicRow(req, context.moduleId, id);
    return result;
  }
}
