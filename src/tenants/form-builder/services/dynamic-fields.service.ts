import { Injectable } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { FORM_BUILDER_MODULE_SEEDS } from '../config/module-seeds';
import { DynamicModule, EntityDynamicData, Form, FormVersion } from '../entities';

export interface DynamicFieldDefinition {
  fieldType: string;
  options: Array<{ label: string; value: string }>;
}

export interface SchemaFieldRef {
  id: string;
  fieldKey: string;
  canonicalKey: string;
  name: string;
  isSystemField: boolean;
  dataKeys: string[];
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
  fieldIdByAnyKey: Map<string, string>;
  /** Set of every valid field id in the current schema. */
  fieldIdSet: Set<string>;
  /**
   * Authoritative owner of a key. Maps a field's own identity keys (id,
   * canonicalKey, fieldKey, name + normalized variants) to that field's id.
   * Used so a field can never claim another field's identity key even if a
   * stale/contaminated `dataKeys` entry references it.
   */
  identityKeyOwner: Map<string, string>;
  schemaFields: SchemaFieldRef[];
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
  private readonly sensitiveResponseKeys = new Set([
    'password',
    'plain_password',
    'password_confirm',
  ]);

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
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if ('url' in record || 'path' in record || 'key' in record) {
        return this.hasPresentValue(record.url ?? record.path ?? record.key);
      }
      return Object.keys(record).length > 0;
    }
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
    context?: DynamicSchemaContext,
  ): { staticPayload: Record<string, any>; dynamicPayload: Record<string, any> } {
    const nextStaticPayload = { ...staticPayload };
    const nextDynamicPayload = { ...dynamicPayload };

    for (const [key, value] of Object.entries(dynamicPayload || {})) {
      const canonicalKey = this.resolvePayloadCanonicalKey(context, aliasToCanonicalMap, key);

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
        fieldIdByAnyKey: new Map(),
        fieldIdSet: new Set(),
        identityKeyOwner: new Map(),
        schemaFields: [],
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
    const fieldIdByAnyKey = new Map<string, string>();
    const fieldIdSet = new Set<string>();
    const identityKeyOwner = new Map<string, string>();
    const schemaFields: SchemaFieldRef[] = [];
    const fieldDefinitions = new Map<string, DynamicFieldDefinition>();

    const fields = backfilledFields;

    // Pass 1: record authoritative ownership of every field's identity keys so a
    // field can never later claim another field's id/canonical/fieldKey/name via
    // a stale `dataKeys` entry.
    for (const field of fields) {
      const fieldKey = String(field.fieldKey || field.name || '').trim();
      const fieldName = String(field.name || fieldKey || '').trim();
      const systemMappingKey = String(field.systemMappingKey || '').trim();
      const canonicalKey =
        field.isSystemField && systemMappingKey ? systemMappingKey : systemMappingKey || fieldKey;
      const fieldId = String(field.id || '').trim();
      if (!canonicalKey || !fieldId) continue;

      fieldIdSet.add(fieldId);

      const identityKeys = [fieldId, canonicalKey, fieldKey, fieldName]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

      for (const key of identityKeys) {
        if (!identityKeyOwner.has(key)) identityKeyOwner.set(key, fieldId);
        const normalized = this.normalizeFieldAlias(key);
        if (normalized && !identityKeyOwner.has(normalized)) identityKeyOwner.set(normalized, fieldId);
      }
    }

    // Pass 2: build alias / canonical / definition maps.
    for (const field of fields) {
      const fieldKey = String(field.fieldKey || field.name || '').trim();
      const fieldName = String(field.name || fieldKey || '').trim();
      const systemMappingKey = String(field.systemMappingKey || '').trim();
      const canonicalKey =
        field.isSystemField && systemMappingKey ? systemMappingKey : systemMappingKey || fieldKey;
      if (!canonicalKey) continue;

      fieldLabels.set(canonicalKey, String(field.label || canonicalKey).trim() || canonicalKey);

      const fieldId = String(field.id || '').trim();

      // Drop any dataKeys that are authoritatively owned by a different field —
      // this neutralizes historical contamination without a data migration.
      const sanitizedDataKeys = (Array.isArray(field.dataKeys) ? field.dataKeys : [])
        .map((value) => String(value || '').trim())
        .filter((value) => value && this.keyOwnerIsSelfOrNone(identityKeyOwner, value, fieldId));

      const dataKeys = Array.from(
        new Set([...sanitizedDataKeys, fieldId, canonicalKey, fieldKey, fieldName]
          .map((value) => String(value || '').trim())
          .filter(Boolean)),
      );

      if (fieldId) {
        fieldIdByCanonicalKey.set(canonicalKey, fieldId);
        if (fieldKey) fieldIdByCanonicalKey.set(fieldKey, fieldId);
        if (systemMappingKey) fieldIdByCanonicalKey.set(systemMappingKey, fieldId);
        if (fieldName && fieldName !== canonicalKey && fieldName !== fieldKey) {
          fieldIdByCanonicalKey.set(fieldName, fieldId);
        }
      }

      const aliases = [
        canonicalKey,
        fieldKey,
        field.name,
        field.label,
        field.id,
        ...dataKeys,
        this.normalizeFieldAlias(field.label || ''),
        this.normalizeFieldAlias(field.fieldKey || ''),
        this.normalizeFieldAlias(field.name || ''),
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

      for (const alias of aliases) {
        if (!aliasToCanonicalMap.has(alias)) aliasToCanonicalMap.set(alias, canonicalKey);
        const normalizedAlias = this.normalizeFieldAlias(alias);
        if (normalizedAlias && !aliasToCanonicalMap.has(normalizedAlias)) {
          aliasToCanonicalMap.set(normalizedAlias, canonicalKey);
        }
        if (fieldId && this.keyOwnerIsSelfOrNone(identityKeyOwner, alias, fieldId)) {
          if (!fieldIdByAnyKey.has(alias)) fieldIdByAnyKey.set(alias, fieldId);
          if (normalizedAlias && !fieldIdByAnyKey.has(normalizedAlias)) {
            fieldIdByAnyKey.set(normalizedAlias, fieldId);
          }
        }
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

      if (fieldId) {
        schemaFields.push({
          id: fieldId,
          fieldKey,
          canonicalKey,
          name: fieldName,
          isSystemField: Boolean(field.isSystemField),
          dataKeys,
        });
      }
    }

    for (const [alias, canonical] of Object.entries(relationFieldAliases)) {
      aliasToCanonicalMap.set(alias, canonical);
      aliasToCanonicalMap.set(this.normalizeFieldAlias(alias), canonical);

      const fieldId = fieldIdByCanonicalKey.get(alias) || fieldIdByCanonicalKey.get(canonical);
      if (fieldId) {
        fieldIdByCanonicalKey.set(alias, fieldId);
        fieldIdByCanonicalKey.set(canonical, fieldId);
      }
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
      fieldIdByAnyKey,
      fieldIdSet,
      identityKeyOwner,
      schemaFields,
      fieldDefinitions,
    };
  }

  /** True when `key` is unowned or owned by `fieldId` (not by another field). */
  private keyOwnerIsSelfOrNone(
    identityKeyOwner: Map<string, string>,
    key: string,
    fieldId: string,
  ): boolean {
    const trimmed = String(key || '').trim();
    if (!trimmed) return false;
    const owner = identityKeyOwner.get(trimmed) ?? identityKeyOwner.get(this.normalizeFieldAlias(trimmed));
    return !owner || owner === fieldId;
  }

  resolveFieldIdForDataKey(context: DynamicSchemaContext, key: string): string | null {
    const trimmed = String(key || '').trim();
    if (!trimmed) return null;

    // A stored key that is itself a valid field id is authoritative.
    if (context.fieldIdSet.has(trimmed)) return trimmed;

    // Authoritative identity owner (canonical / fieldKey / name).
    const owner =
      context.identityKeyOwner.get(trimmed) ??
      context.identityKeyOwner.get(this.normalizeFieldAlias(trimmed));
    if (owner) return owner;

    // Fallback: historical dataKeys aliases.
    const direct = context.fieldIdByAnyKey.get(trimmed);
    if (direct) return direct;

    const normalized = this.normalizeFieldAlias(trimmed);
    if (normalized) {
      const fromNormalized = context.fieldIdByAnyKey.get(normalized);
      if (fromNormalized) return fromNormalized;
    }

    return null;
  }

  normalizeDynamicDataToFieldIds(
    data: Record<string, any>,
    context: DynamicSchemaContext,
  ): Record<string, any> {
    const result: Record<string, any> = {};
    const fieldIdValues = new Map<string, any>();
    const aliasValues = new Map<string, any>();

    for (const [key, value] of Object.entries(data || {})) {
      const fieldId = this.resolveFieldIdForDataKey(context, key);
      if (!fieldId) {
        result[key] = value;
        continue;
      }

      if (key === fieldId) {
        fieldIdValues.set(fieldId, value);
        continue;
      }

      aliasValues.set(fieldId, value);
    }

    for (const [fieldId, value] of fieldIdValues.entries()) {
      result[fieldId] = value;
    }

    for (const [fieldId, value] of aliasValues.entries()) {
      result[fieldId] = value;
    }

    return result;
  }

  private findDynamicValueForField(
    dynamicData: Record<string, any>,
    field: SchemaFieldRef,
    context: DynamicSchemaContext,
    consumedKeys: Set<string>,
  ): unknown {
    const lookupKeys = Array.from(
      new Set([field.id, field.canonicalKey, field.fieldKey, field.name, ...field.dataKeys].filter(Boolean)),
    );

    for (const key of lookupKeys) {
      if (consumedKeys.has(key)) continue;
      if (!Object.prototype.hasOwnProperty.call(dynamicData, key)) continue;
      // Never claim a stored key that authoritatively belongs to another field.
      if (!this.keyOwnerIsSelfOrNone(context.identityKeyOwner, key, field.id)) continue;
      consumedKeys.add(key);
      return dynamicData[key];
    }

    for (const [key, value] of Object.entries(dynamicData)) {
      if (consumedKeys.has(key)) continue;
      if (this.resolveFieldIdForDataKey(context, key) === field.id) {
        consumedKeys.add(key);
        return value;
      }
    }

    return undefined;
  }

  /**
   * When a form schema changes (label / fieldKey rename), migrate stored dynamic
   * values from legacy keys onto the stable field id.
   */
  async migrateDynamicDataKeysOnSchemaChange(
    req: any,
    moduleId: number | null,
    oldFields: any[],
    newFields: any[],
  ): Promise<void> {
    if (!moduleId) return;

    const renames = new Map<string, string>();

    for (const newField of newFields || []) {
      const fieldId = String(newField?.id || '').trim();
      if (!fieldId) continue;

      const oldField = (oldFields || []).find((field) => String(field?.id || '').trim() === fieldId);
      const keys = new Set<string>(
        [
          ...(Array.isArray(oldField?.dataKeys) ? oldField.dataKeys : []),
          oldField?.fieldKey,
          oldField?.name,
          newField?.fieldKey,
          newField?.name,
          ...(Array.isArray(newField?.dataKeys) ? newField.dataKeys : []),
        ]
          .map((value) => String(value || '').trim())
          .filter((value) => value && value !== fieldId),
      );

      for (const key of keys) {
        renames.set(key, fieldId);
      }
    }

    if (!renames.size) return;

    const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
    const rows = await dynamicRepo.find({ where: { moduleId } });

    for (const row of rows) {
      const data = { ...(row.data || {}) };
      let changed = false;

      for (const [legacyKey, fieldId] of renames.entries()) {
        if (!Object.prototype.hasOwnProperty.call(data, legacyKey)) continue;
        if (!Object.prototype.hasOwnProperty.call(data, fieldId)) {
          data[fieldId] = data[legacyKey];
        }
        if (legacyKey !== fieldId) {
          delete data[legacyKey];
        }
        changed = true;
      }

      if (changed) {
        row.data = data;
        await dynamicRepo.save(row);
      }
    }
  }

  resolveCanonicalKey(context: DynamicSchemaContext, key: string): string {
    return this.resolvePayloadCanonicalKey(context, context.aliasToCanonicalMap, key);
  }

  /** Maps any incoming payload key (fld_ id, fieldKey, label alias) to its canonical key. */
  resolvePayloadCanonicalKey(
    context: DynamicSchemaContext | undefined,
    aliasToCanonicalMap: Map<string, string>,
    key: string,
  ): string {
    const trimmed = String(key || '').trim();
    if (!trimmed) return trimmed;

    const fromAlias =
      aliasToCanonicalMap.get(trimmed) ||
      aliasToCanonicalMap.get(this.normalizeFieldAlias(trimmed));
    if (fromAlias) return this.finalizePayloadCanonicalKey(aliasToCanonicalMap, fromAlias);

    if (!context) return trimmed;

    const fieldId = this.resolveFieldIdForDataKey(context, trimmed);
    if (!fieldId) return trimmed;

    const field = context.schemaFields.find((item) => item.id === fieldId);
    const resolved = field?.canonicalKey || field?.fieldKey || trimmed;
    return this.finalizePayloadCanonicalKey(aliasToCanonicalMap, resolved);
  }

  /** Follow one more alias hop (e.g. item_name -> name via relationFieldAliases). */
  private finalizePayloadCanonicalKey(aliasToCanonicalMap: Map<string, string>, key: string): string {
    const remapped =
      aliasToCanonicalMap.get(key) ||
      aliasToCanonicalMap.get(this.normalizeFieldAlias(key));
    return remapped && remapped !== key ? remapped : key;
  }

  resolvePayloadAliases(
    payload: Record<string, any>,
    aliasToCanonicalMap: Map<string, string>,
    context?: DynamicSchemaContext,
  ): Record<string, any> {
    const normalizedPayload: Record<string, any> = {};

    for (const [rawKey, value] of Object.entries(payload || {})) {
      const key = String(rawKey || '').trim();
      if (!key) continue;

      const canonicalKey = this.resolvePayloadCanonicalKey(context, aliasToCanonicalMap, key);

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

  private isSensitiveResponseKey(key: string): boolean {
    const trimmed = String(key || '').trim();
    if (!trimmed) return false;
    if (this.sensitiveResponseKeys.has(trimmed)) return true;
    return this.sensitiveResponseKeys.has(this.normalizeFieldAlias(trimmed));
  }

  private isSensitiveSchemaField(field: SchemaFieldRef): boolean {
    const keys = [field.canonicalKey, field.fieldKey, field.name, ...field.dataKeys];
    return keys.some((key) => this.isSensitiveResponseKey(key));
  }

  private stripSensitiveResponseFields(
    context: DynamicSchemaContext,
    response: Record<string, any>,
  ): Record<string, any> {
    const next = { ...response };

    for (const key of Object.keys(next)) {
      if (this.isSensitiveResponseKey(key)) {
        delete next[key];
      }
    }

    for (const field of context.schemaFields) {
      if (this.isSensitiveSchemaField(field)) {
        delete next[field.id];
      }
    }

    return next;
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
      return this.stripSensitiveResponseFields(context, {
        ...filteredDynamicData,
        ...systemValues,
        ...meta,
      });
    }

    const idKeyed: Record<string, any> = {};
    const consumedKeys = new Set<string>();

    for (const [canonicalKey, value] of Object.entries(systemValues)) {
      if (this.isSensitiveResponseKey(canonicalKey)) continue;
      const fieldId = this.resolveFieldIdForSystemValue(
        canonicalKey,
        fieldIdByCanonicalKey,
        context.aliasToCanonicalMap,
      );
      if (fieldId && !(fieldId in idKeyed)) idKeyed[fieldId] = value;
    }

    // Pass 1: stored keys that ARE an exact field id are authoritative — attribute
    // them to that field before any dataKeys-based resolution so a field can never
    // steal another field's id-keyed value.
    for (const [key, value] of Object.entries(filteredDynamicData)) {
      if (!context.fieldIdSet.has(key)) continue;
      if (!(key in idKeyed)) idKeyed[key] = value;
      consumedKeys.add(key);
    }

    // Pass 2: attribute remaining values by each field's identity / historical keys.
    for (const field of context.schemaFields) {
      if (field.isSystemField) continue;
      if (field.id in idKeyed) continue;

      const value = this.findDynamicValueForField(filteredDynamicData, field, context, consumedKeys);
      if (value !== undefined) {
        idKeyed[field.id] = value;
      }
    }

    // Pass 3: pass through orphans (keys that map to no current field).
    for (const [key, value] of Object.entries(filteredDynamicData)) {
      if (consumedKeys.has(key)) continue;

      const fieldId = this.resolveFieldIdForDataKey(context, key);
      if (fieldId) {
        if (!(fieldId in idKeyed)) idKeyed[fieldId] = value;
        continue;
      }

      idKeyed[key] = value;
    }

    return this.stripSensitiveResponseFields(context, { ...idKeyed, ...meta });
  }

  /** Resolves a system-column key (e.g. phone_number) to its form field id. */
  private resolveFieldIdForSystemValue(
    systemKey: string,
    fieldIdByCanonicalKey: Map<string, string>,
    aliasToCanonicalMap: Map<string, string>,
  ): string | undefined {
    const direct = fieldIdByCanonicalKey.get(systemKey);
    if (direct) return direct;

    for (const [alias, canonical] of aliasToCanonicalMap.entries()) {
      if (canonical !== systemKey) continue;
      const fieldId = fieldIdByCanonicalKey.get(alias) || fieldIdByCanonicalKey.get(canonical);
      if (fieldId) return fieldId;
    }

    return undefined;
  }

  async loadDynamicRows(
    req: any,
    moduleId: number | null,
    entityIds: number[],
    context?: DynamicSchemaContext,
  ): Promise<Map<number, Record<string, any>>> {
    const result = new Map<number, Record<string, any>>();
    if (!moduleId || !entityIds.length) return result;

    const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
    const rows = await dynamicRepo.find({ where: { moduleId, entityId: In(entityIds) } });
    for (const row of rows) {
      const data = row.data || {};
      result.set(
        row.entityId,
        context ? this.normalizeDynamicDataToFieldIds(data, context) : data,
      );
    }
    return result;
  }

  async loadDynamicRow(
    req: any,
    moduleId: number | null,
    entityId: number,
    context?: DynamicSchemaContext,
  ): Promise<Record<string, any>> {
    if (!moduleId) return {};
    const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
    const row = await dynamicRepo.findOne({ where: { moduleId, entityId } });
    const data = row?.data || {};
    return context ? this.normalizeDynamicDataToFieldIds(data, context) : data;
  }

  async upsertDynamicRow(
    req: any,
    moduleId: number | null,
    entityId: number,
    formVersionId: number | null,
    data: Record<string, any>,
    actorId: number | null,
    context?: DynamicSchemaContext,
  ): Promise<void> {
    if (!moduleId) return;

    const payload = context ? this.normalizeDynamicDataToFieldIds(data, context) : data;

    const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
    let row = await dynamicRepo.findOne({ where: { moduleId, entityId } });

    if (!row) {
      row = dynamicRepo.create({
        moduleId,
        entityId,
        formVersionId,
        data: payload,
        createdBy: actorId,
        updatedBy: actorId,
      });
    } else {
      row.formVersionId = formVersionId;
      row.data = payload;
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
      const storageKey = this.resolveFieldIdForDataKey(context, key) || canonicalKey;

      this.applyDynamicFieldFilter(dynamicQb, idx, storageKey, value, fieldDefinition);
      idx += 1;
    }

    const matched = await dynamicQb.getRawMany<{ entityId: string }>();
    return matched.map((row) => Number(row.entityId)).filter((id) => Number.isFinite(id));
  }
}
