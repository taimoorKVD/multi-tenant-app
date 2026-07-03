import { Injectable } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { FORM_BUILDER_MODULE_SEEDS } from '../config/module-seeds';
import { DynamicModule, EntityDynamicData, Form, FormVersion } from '../entities';

export interface DynamicFieldDefinition {
  fieldType: string;
  options: Array<{ label: string; value: string }>;
}

export interface DynamicSchemaContext {
  moduleId: number | null;
  formId: number | null;
  activeVersionId: number | null;
  systemFieldKeys: Set<string>;
  requiredFieldKeys: Set<string>;
  fieldLabels: Map<string, string>;
  aliasToCanonicalMap: Map<string, string>;
  fieldIdByCanonicalKey: Map<string, string>;
  fieldDefinitions: Map<string, DynamicFieldDefinition>;
}

export interface SchemaContextOptions {
  fallbackSystemFieldKeys?: Iterable<string>;
  relationFieldAliases?: Record<string, string>;
}

/**
 * Shared helper that maps form-builder schema fields to their stable field ids
 * (fld_...), splits payloads into entity (static) vs dynamic values, persists
 * dynamic values in entity_dynamic_data, and builds id-keyed responses / filters.
 *
 * This centralizes the pattern originally implemented inline in UsersService so
 * that other modules (items, locations, ...) can reuse the exact same behavior.
 */
@Injectable()
export class DynamicFieldsService {
  normalizeFieldAlias(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  hasPresentValue(value: unknown): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  private generateFieldId(): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 9);
    return `fld_${timestamp}_${randomString}`;
  }

  /**
   * Assigns stable field ids to schema fields that are missing them. Matches
   * default seed fields by key/systemMappingKey; custom fields get a new id.
   */
  backfillMissingFieldIds(
    fields: any[],
    slug: string,
  ): { fields: any[]; changed: boolean } {
    const seed = FORM_BUILDER_MODULE_SEEDS.find((item) => item.slug === slug);
    const seedIdByKey = new Map<string, string>();

    for (const item of seed?.defaultFields ?? []) {
      if (!item.id) continue;
      seedIdByKey.set(item.key, item.id);
      if (item.systemMappingKey) seedIdByKey.set(item.systemMappingKey, item.id);
      seedIdByKey.set(item.name, item.id);
    }

    let changed = false;
    const next = (Array.isArray(fields) ? fields : []).map((field) => {
      if (String(field?.id || '').trim()) return field;

      const fieldKey = String(field.fieldKey || field.name || '').trim();
      const systemMappingKey = String(field.systemMappingKey || '').trim();
      const seedId =
        (fieldKey ? seedIdByKey.get(fieldKey) : undefined) ||
        (systemMappingKey ? seedIdByKey.get(systemMappingKey) : undefined);

      changed = true;
      return { ...field, id: seedId || this.generateFieldId() };
    });

    return { fields: next, changed };
  }

  promoteDynamicSystemFields(
    staticPayload: Record<string, any>,
    dynamicPayload: Record<string, any>,
    aliasToCanonicalMap: Map<string, string>,
    systemFieldKeys: Set<string>,
  ): { staticPayload: Record<string, any>; dynamicPayload: Record<string, any> } {
    const nextStaticPayload = { ...staticPayload };
    const nextDynamicPayload = { ...dynamicPayload };

    for (const [key, value] of Object.entries(dynamicPayload || {})) {
      const canonicalKey =
        aliasToCanonicalMap.get(key) ||
        aliasToCanonicalMap.get(this.normalizeFieldAlias(key)) ||
        key;

      if (!systemFieldKeys.has(canonicalKey) || !this.hasPresentValue(value)) continue;

      if (!this.hasPresentValue(nextStaticPayload[canonicalKey])) {
        nextStaticPayload[canonicalKey] = value;
        delete nextDynamicPayload[key];
      }
    }

    return { staticPayload: nextStaticPayload, dynamicPayload: nextDynamicPayload };
  }

  private isTruthySchemaFlag(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'required'].includes(value.trim().toLowerCase());
    }
    return false;
  }

  private isRequiredField(field: Record<string, any>): boolean {
    if (this.isTruthySchemaFlag(field.isRequired) || this.isTruthySchemaFlag(field.required)) {
      return true;
    }

    const validations = Array.isArray(field.validations) ? field.validations : [];
    return validations.some((validation) => {
      if (!validation || typeof validation !== 'object') return false;
      return (
        this.isTruthySchemaFlag(validation.isRequired) ||
        this.isTruthySchemaFlag(validation.required) ||
        String(validation.ruleType || validation.type || '')
          .trim()
          .toLowerCase() === 'required'
      );
    });
  }

  async getSchemaContext(
    req: any,
    slug: string,
    options: SchemaContextOptions = {},
  ): Promise<DynamicSchemaContext> {
    const fallbackSystemFieldKeys = new Set<string>(options.fallbackSystemFieldKeys ?? []);
    const relationFieldAliases = options.relationFieldAliases ?? {};

    const emptyContext = (moduleId: number | null, formId: number | null): DynamicSchemaContext => {
      const systemFieldKeys = new Set<string>(fallbackSystemFieldKeys);
      const aliasToCanonicalMap = new Map<string, string>();
      for (const key of systemFieldKeys) {
        aliasToCanonicalMap.set(key, key);
        const normalized = this.normalizeFieldAlias(key);
        if (normalized) aliasToCanonicalMap.set(normalized, key);
      }
      for (const [alias, canonical] of Object.entries(relationFieldAliases)) {
        aliasToCanonicalMap.set(alias, canonical);
        aliasToCanonicalMap.set(this.normalizeFieldAlias(alias), canonical);
      }
      return {
        moduleId,
        formId,
        activeVersionId: null,
        systemFieldKeys,
        requiredFieldKeys: new Set(),
        fieldLabels: new Map(),
        aliasToCanonicalMap,
        fieldIdByCanonicalKey: new Map(),
        fieldDefinitions: new Map(),
      };
    };

    const moduleRepo = req.tenantConnection.getRepository(DynamicModule);
    const formRepo = req.tenantConnection.getRepository(Form);
    const versionRepo = req.tenantConnection.getRepository(FormVersion);

    const moduleEntity = await moduleRepo.findOne({ where: { slug } });
    if (!moduleEntity) return emptyContext(null, null);

    const form = await formRepo.findOne({
      where: { moduleId: moduleEntity.id },
      order: { createdAt: 'DESC' },
    });
    if (!form) return emptyContext(moduleEntity.id, null);

    const activeVersion = await versionRepo.findOne({ where: { formId: form.id, isActive: true } });

    const rawFields = form.autosaveSchema?.fields || [];
    const { fields: backfilledFields, changed: idsBackfilled } = this.backfillMissingFieldIds(rawFields, slug);
    if (idsBackfilled) {
      form.autosaveSchema = { ...(form.autosaveSchema || {}), fields: backfilledFields };
      await formRepo.save(form);
    }

    const systemFieldKeys = new Set<string>();
    const requiredFieldKeys = new Set<string>();
    const fieldLabels = new Map<string, string>();
    const aliasToCanonicalMap = new Map<string, string>();
    const fieldIdByCanonicalKey = new Map<string, string>();
    const fieldDefinitions = new Map<string, DynamicFieldDefinition>();

    const fields = backfilledFields;

    for (const field of fields) {
      const fieldKey = String(field.fieldKey || field.name || '').trim();
      const systemMappingKey = String(field.systemMappingKey || '').trim();
      const canonicalKey =
        field.isSystemField && systemMappingKey ? systemMappingKey : systemMappingKey || fieldKey;
      if (!canonicalKey) continue;

      fieldLabels.set(canonicalKey, String(field.label || canonicalKey).trim() || canonicalKey);

      const fieldId = String(field.id || '').trim();
      if (fieldId) {
        fieldIdByCanonicalKey.set(canonicalKey, fieldId);
        if (fieldKey) fieldIdByCanonicalKey.set(fieldKey, fieldId);
      }

      const aliases = [
        canonicalKey,
        fieldKey,
        field.name,
        field.label,
        field.id,
        this.normalizeFieldAlias(field.label || ''),
        this.normalizeFieldAlias(field.fieldKey || ''),
        this.normalizeFieldAlias(field.name || ''),
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

      for (const alias of aliases) {
        aliasToCanonicalMap.set(alias, canonicalKey);
        const normalizedAlias = this.normalizeFieldAlias(alias);
        if (normalizedAlias) aliasToCanonicalMap.set(normalizedAlias, canonicalKey);
      }

      if (field.isSystemField) systemFieldKeys.add(canonicalKey);
      if (this.isRequiredField(field)) requiredFieldKeys.add(canonicalKey);

      const fieldType = String(field.fieldTypeName || field.type || '').trim().toLowerCase();
      const options = (Array.isArray(field.options) ? field.options : []).map(
        (option: Record<string, any>) => ({
          label: String(option?.label ?? '').trim(),
          value: String(option?.value ?? '').trim(),
        }),
      );
      const definition: DynamicFieldDefinition = { fieldType, options };
      fieldDefinitions.set(canonicalKey, definition);
      if (fieldKey) fieldDefinitions.set(fieldKey, definition);
    }

    for (const [alias, canonical] of Object.entries(relationFieldAliases)) {
      aliasToCanonicalMap.set(alias, canonical);
      aliasToCanonicalMap.set(this.normalizeFieldAlias(alias), canonical);
    }

    fallbackSystemFieldKeys.forEach((key) => {
      systemFieldKeys.add(key);
      if (!aliasToCanonicalMap.has(key)) aliasToCanonicalMap.set(key, key);
      const normalized = this.normalizeFieldAlias(key);
      if (normalized && !aliasToCanonicalMap.has(normalized)) {
        aliasToCanonicalMap.set(normalized, key);
      }
    });

    return {
      moduleId: moduleEntity.id,
      formId: form.id,
      activeVersionId: activeVersion?.id ?? null,
      systemFieldKeys,
      requiredFieldKeys,
      fieldLabels,
      aliasToCanonicalMap,
      fieldIdByCanonicalKey,
      fieldDefinitions,
    };
  }

  resolveCanonicalKey(context: DynamicSchemaContext, key: string): string {
    return (
      context.aliasToCanonicalMap.get(key) ||
      context.aliasToCanonicalMap.get(this.normalizeFieldAlias(key)) ||
      key
    );
  }

  resolvePayloadAliases(
    payload: Record<string, any>,
    aliasToCanonicalMap: Map<string, string>,
  ): Record<string, any> {
    const normalizedPayload: Record<string, any> = {};

    for (const [rawKey, value] of Object.entries(payload || {})) {
      const key = String(rawKey || '').trim();
      if (!key) continue;

      const normalizedKey = this.normalizeFieldAlias(key);
      const canonicalKey = aliasToCanonicalMap.get(key) || aliasToCanonicalMap.get(normalizedKey) || key;

      const hasCanonicalValue = Object.prototype.hasOwnProperty.call(normalizedPayload, canonicalKey);
      if (!hasCanonicalValue) {
        normalizedPayload[canonicalKey] = value;
        continue;
      }

      if (key === canonicalKey) {
        if (this.hasPresentValue(value) || !this.hasPresentValue(normalizedPayload[canonicalKey])) {
          normalizedPayload[canonicalKey] = value;
        }
        continue;
      }

      if (this.hasPresentValue(value) && !this.hasPresentValue(normalizedPayload[canonicalKey])) {
        normalizedPayload[canonicalKey] = value;
      }
    }

    return normalizedPayload;
  }

  splitPayload(
    payload: Record<string, any>,
    systemFieldKeys: Set<string>,
    ignoredKeys: Set<string> = new Set(),
  ): { staticPayload: Record<string, any>; dynamicPayload: Record<string, any> } {
    const staticPayload: Record<string, any> = {};
    const dynamicPayload: Record<string, any> = {};

    for (const [key, value] of Object.entries(payload || {})) {
      if (ignoredKeys.has(key)) continue;
      if (systemFieldKeys.has(key)) {
        staticPayload[key] = value;
      } else {
        dynamicPayload[key] = value;
      }
    }

    return { staticPayload, dynamicPayload };
  }

  private filterDynamicDataForResponse(
    dynamicData: Record<string, any>,
    aliasToCanonicalMap: Map<string, string>,
    systemFieldKeys: Set<string>,
  ): Record<string, any> {
    const filtered: Record<string, any> = {};

    for (const [key, value] of Object.entries(dynamicData || {})) {
      const normalizedKey = this.normalizeFieldAlias(key);
      const canonicalKey = aliasToCanonicalMap.get(key) || aliasToCanonicalMap.get(normalizedKey) || key;
      if (systemFieldKeys.has(canonicalKey) || systemFieldKeys.has(key)) continue;
      filtered[key] = value;
    }

    return filtered;
  }

  /**
   * Builds a response object keyed by stable field ids (fld_...). System field
   * values are supplied by canonical key in `systemValues`; the remaining custom
   * values come from `dynamicData`. `meta` is appended verbatim (id, timestamps).
   *
   * When the schema carries no field ids (e.g. not yet bootstrapped) it falls
   * back to a human-readable shape merging systemValues + dynamicData + meta.
   */
  buildResponse(
    context: DynamicSchemaContext,
    systemValues: Record<string, any>,
    dynamicData: Record<string, any>,
    meta: Record<string, any>,
  ): Record<string, any> {
    const filteredDynamicData = this.filterDynamicDataForResponse(
      dynamicData,
      context.aliasToCanonicalMap,
      context.systemFieldKeys,
    );

    const fieldIdByCanonicalKey = context.fieldIdByCanonicalKey;
    if (!fieldIdByCanonicalKey || fieldIdByCanonicalKey.size === 0) {
      return { ...filteredDynamicData, ...systemValues, ...meta };
    }

    const idKeyed: Record<string, any> = {};

    for (const [canonicalKey, value] of Object.entries(systemValues)) {
      const fieldId = fieldIdByCanonicalKey.get(canonicalKey);
      if (fieldId && !(fieldId in idKeyed)) idKeyed[fieldId] = value;
    }

    for (const [key, value] of Object.entries(filteredDynamicData)) {
      const canonicalKey = this.resolveCanonicalKey(context, key);
      const fieldId = fieldIdByCanonicalKey.get(canonicalKey) || fieldIdByCanonicalKey.get(key);
      if (fieldId && !(fieldId in idKeyed)) {
        idKeyed[fieldId] = value;
      } else if (!fieldId) {
        idKeyed[key] = value;
      }
    }

    return { ...idKeyed, ...meta };
  }

  async loadDynamicRows(
    req: any,
    moduleId: number | null,
    entityIds: number[],
  ): Promise<Map<number, Record<string, any>>> {
    const result = new Map<number, Record<string, any>>();
    if (!moduleId || !entityIds.length) return result;

    const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
    const rows = await dynamicRepo.find({ where: { moduleId, entityId: In(entityIds) } });
    for (const row of rows) {
      result.set(row.entityId, row.data || {});
    }
    return result;
  }

  async loadDynamicRow(
    req: any,
    moduleId: number | null,
    entityId: number,
  ): Promise<Record<string, any>> {
    if (!moduleId) return {};
    const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
    const row = await dynamicRepo.findOne({ where: { moduleId, entityId } });
    return row?.data || {};
  }

  async upsertDynamicRow(
    req: any,
    moduleId: number | null,
    entityId: number,
    formVersionId: number | null,
    data: Record<string, any>,
    actorId: number | null,
  ): Promise<void> {
    if (!moduleId) return;

    const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
    let row = await dynamicRepo.findOne({ where: { moduleId, entityId } });

    if (!row) {
      row = dynamicRepo.create({
        moduleId,
        entityId,
        formVersionId,
        data,
        createdBy: actorId,
        updatedBy: actorId,
      });
    } else {
      row.formVersionId = formVersionId;
      row.data = data;
      row.updatedBy = actorId;
    }

    await dynamicRepo.save(row);
  }

  async deleteDynamicRow(req: any, moduleId: number | null, entityId: number): Promise<void> {
    if (!moduleId) return;
    const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
    await dynamicRepo.delete({ moduleId, entityId });
  }

  private resolveCheckboxOptionIndex(
    options: Array<{ label?: string; value?: string }>,
    filterValue: string,
  ): number | null {
    const normalizedFilter = this.normalizeFieldAlias(filterValue);
    if (/^\d+$/.test(filterValue)) return Number(filterValue);

    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      const value = String(option?.value ?? '').trim();
      const label = String(option?.label ?? '').trim();
      if (
        value === filterValue ||
        this.normalizeFieldAlias(value) === normalizedFilter ||
        label.toLowerCase() === filterValue.toLowerCase() ||
        this.normalizeFieldAlias(label) === normalizedFilter
      ) {
        return index;
      }
    }
    return null;
  }

  private applyDynamicFieldFilter(
    dynamicQb: any,
    idx: number,
    key: string,
    value: string,
    fieldDefinition?: DynamicFieldDefinition,
  ): void {
    const fieldType = fieldDefinition?.fieldType?.toLowerCase() ?? '';

    if (fieldType === 'checkbox') {
      const selectedOptions = value
        .split(',')
        .map((option) => option.trim())
        .filter(Boolean);

      selectedOptions.forEach((optionValue) => {
        dynamicQb.andWhere(`dynamic.data->:key::text @> :value::jsonb`, {
          key,
          value: JSON.stringify([optionValue]),
        });
      });
      return;
    }

    dynamicQb.andWhere(
      `LOWER(COALESCE(jsonb_extract_path_text(dynamic.data, :pathKey${idx}), '')) LIKE :pathValue${idx}`,
      {
        [`pathKey${idx}`]: key,
        [`pathValue${idx}`]: `%${value.toLowerCase()}%`,
      },
    );
  }

  /**
   * Returns the entity ids whose dynamic data matches every provided filter, or
   * null when the filters can't be satisfied (no module / no matches).
   */
  async findDynamicMatchedIds(
    req: any,
    context: DynamicSchemaContext,
    trueDynamicFilters: Record<string, string>,
  ): Promise<number[] | null> {
    if (!Object.keys(trueDynamicFilters).length) return null;
    if (!context.moduleId) return [];

    const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
    const dynamicQb = dynamicRepo
      .createQueryBuilder('dynamic')
      .select('dynamic.entityId', 'entityId')
      .where('dynamic.moduleId = :moduleId', { moduleId: context.moduleId });

    let idx = 0;
    for (const [key, value] of Object.entries(trueDynamicFilters)) {
      if (!/^[a-zA-Z0-9_\-]+$/.test(key)) continue;

      const canonicalKey = this.resolveCanonicalKey(context, key);
      const fieldDefinition =
        context.fieldDefinitions.get(key) || context.fieldDefinitions.get(canonicalKey);

      this.applyDynamicFieldFilter(dynamicQb, idx, canonicalKey, value, fieldDefinition);
      idx += 1;
    }

    const matched = await dynamicQb.getRawMany<{ entityId: string }>();
    return matched.map((row) => Number(row.entityId)).filter((id) => Number.isFinite(id));
  }
}
