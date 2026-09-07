import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  CreateFormDto,
  SaveSchemaDto,
  UpdateFormDto,
} from '../dto';
import {
  DynamicModule,
  Form,
  FormStatus,
  FormVersion,
} from '../entities';
import {
  FORM_BUILDER_MODULE_SEEDS,
  FormBuilderFieldSeed,
  FormBuilderModuleType,
  resolveFormBuilderModuleType,
} from '../config/module-seeds';
import { AuditLogService } from './audit-log.service';
import { DynamicFieldsService } from './dynamic-fields.service';
import { UploadsService } from '../../uploads/uploads.service';

@Injectable()
export class FormsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly dynamicFieldsService: DynamicFieldsService,
    private readonly uploadsService: UploadsService,
  ) {}

  private getActorId(req: any, fallback?: number | null): number | null {
    const candidate = fallback ?? req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) {
      return null;
    }

    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  private readonly modulesSeed = FORM_BUILDER_MODULE_SEEDS.map(({ slug, name }) => ({ slug, name }));
  private readonly moduleSeedBySlug = new Map(
    FORM_BUILDER_MODULE_SEEDS.map((seed) => [seed.slug, seed]),
  );

  /**
   * System identity fields that must stay fillable on create/edit forms
   * (`isReadonly: false`). Builder lock uses `isEditable` separately.
   */
  private readonly editableIdentityFieldKeys = new Set([
    'name',
    'email',
    'password',
    'item_name',
    'vendor_name',
  ]);

  private isIdentityField(field: any): boolean {
    const fieldKey = String(field?.fieldKey || field?.name || field?.key || '').trim();
    const mappingKey = String(field?.systemMappingKey || '').trim();
    return (
      this.editableIdentityFieldKeys.has(fieldKey) ||
      this.editableIdentityFieldKeys.has(mappingKey)
    );
  }

  private withFormType<T extends Form>(form: T): T & { type: FormBuilderModuleType } {
    const type = resolveFormBuilderModuleType(form.module?.slug);
    if (form.module) {
      this.withModuleType(form.module);
    }
    return Object.assign(form, { type });
  }

  private withModuleType<T extends DynamicModule>(module: T): T & { type: FormBuilderModuleType } {
    return Object.assign(module, {
      type: resolveFormBuilderModuleType(module.slug),
    });
  }

  private repairIdentityFieldsReadonly(fields: any[]): { fields: any[]; changed: boolean } {
    let changed = false;
    const next = (fields || []).map((field) => {
      if (!field || typeof field !== 'object' || Array.isArray(field)) return field;
      if (!this.isIdentityField(field)) return field;
      // Keep fillable on user forms; do not override builder lock (`isEditable`).
      if (field.isReadonly === false) return field;
      changed = true;
      return {
        ...field,
        isReadonly: false,
      };
    });
    return { fields: next, changed };
  }

  private async ensureCoreModules(req: any): Promise<void> {
    const repo = req.tenantConnection.getRepository(DynamicModule);
    const existing = await repo.find({
      where: { slug: In(this.modulesSeed.map((item) => item.slug)) },
    });

    if (existing.length === this.modulesSeed.length) {
      return;
    }

    const existingSlugs = new Set(existing.map((item) => item.slug));
    const actor = this.getActorId(req);
    const inserts = this.modulesSeed
      .filter((item) => !existingSlugs.has(item.slug))
      .map((item) =>
        repo.create({
          slug: item.slug,
          name: item.name,
          isActive: true,
          createdBy: actor,
          updatedBy: actor,
        }),
      );

    if (inserts.length) {
      await repo.save(inserts);
    }
  }

  private async buildRuntimeSnapshot(req: any, formId: number): Promise<Record<string, any>> {
    const formRepo = req.tenantConnection.getRepository(Form);
    const form = await formRepo.findOne({ where: { id: formId }, relations: ['module'] });
    if (!form) throw new NotFoundException('Form not found');

    // Prefer JSON schema stored on the form (autosaveSchema).
    const schema = form.autosaveSchema || { fields: [] };

    return this.normalizeSchemaSnapshot(form as Form & { module?: DynamicModule | null }, schema);
  }

  private async ensureFormFieldIds(req: any, form: Form, slug: string): Promise<Form> {
    const formRepo = req.tenantConnection.getRepository(Form);
    const rawFields = form.autosaveSchema?.fields || [];
    const { fields: withIds, changed: idsChanged } =
      this.dynamicFieldsService.backfillMissingFieldIds(rawFields, slug);
    const { fields: withReadonly, changed: readonlyChanged } =
      this.repairIdentityFieldsReadonly(withIds);
    const { fields, changed: imageChanged } = this.ensureImageSeedField(
      req,
      withReadonly,
      slug,
    );

    if (!idsChanged && !readonlyChanged && !imageChanged) return form;

    form.autosaveSchema = { ...(form.autosaveSchema || {}), fields };
    return formRepo.save(form);
  }

  private ensureImageSeedField(
    req: any,
    fields: any[],
    slug: string,
  ): { fields: any[]; changed: boolean } {
    const seed = this.moduleSeedBySlug.get(slug);
    const imageSeed = (seed?.defaultFields || []).find((item) => item.type === 'image');
    if (!imageSeed) {
      return { fields, changed: false };
    }

    const list = Array.isArray(fields) ? [...fields] : [];
    const key = String(imageSeed.key || imageSeed.name || '').trim().toLowerCase();
    const index = list.findIndex((field) => {
      const fieldKey = String(field?.fieldKey || field?.name || '')
        .trim()
        .toLowerCase();
      return fieldKey === key || String(field?.id || '').trim() === String(imageSeed.id || '');
    });

    const logo = this.resolveLogoReference(req);
    let changed = false;

    if (index < 0) {
      list.push(this.mapImageSeedToSchema(imageSeed, list.length, logo));
      changed = true;
    } else {
      const current = { ...list[index] };
      const refs = Array.isArray(current.referenceImages) ? current.referenceImages : [];
      if (!refs.length && logo) {
        current.referenceImages = [logo];
        current.type = 'image';
        current.fieldTypeName = 'image';
        if (typeof current.multiple !== 'boolean') {
          current.multiple = imageSeed.multiple ?? true;
        }
        if (current.minFiles == null) current.minFiles = imageSeed.minFiles ?? 1;
        if (current.maxFiles == null) current.maxFiles = imageSeed.maxFiles ?? 5;
        list[index] = current;
        changed = true;
      }
    }

    return { fields: list, changed };
  }

  private resolveLogoReference(req: any) {
    try {
      const origin =
        `${req?.protocol || 'http'}://${req?.get?.('host') || req?.headers?.host || `localhost:${process.env.PORT || 3000}`}`.replace(
          /\/+$/,
          '',
        );
      return this.uploadsService.ensureBundledLogoReference(
        String(req?.tenantId || 'local'),
        origin,
      );
    } catch {
      return null;
    }
  }

  private mapImageSeedToSchema(
    item: FormBuilderFieldSeed,
    index: number,
    logo: ReturnType<UploadsService['ensureBundledLogoReference']> | null,
  ) {
    return {
      id: item.id,
      fieldKey: item.key,
      label: item.label,
      name: item.name,
      type: 'image',
      fieldTypeName: 'image',
      placeholder: item.placeholder ?? 'Placeholder text',
      helpText: item.helpText ?? null,
      isRequired: item.isRequired ?? false,
      isUnique: item.isUnique ?? false,
      isReadonly: !(item.isEditable ?? true),
      isSystemField: false,
      systemMappingKey: null,
      isShow: item.isShow ?? true,
      order: index,
      referenceImages:
        item.referenceImages?.length
          ? item.referenceImages
          : logo
            ? [logo]
            : [],
      multiple: item.multiple ?? true,
      minFiles: item.minFiles ?? 1,
      maxFiles: item.maxFiles ?? 5,
    };
  }

  private preserveFieldMetadata(oldFields: any[], newFields: any[]): any[] {
    const oldById = new Map<string, any>();
    const idByFieldKey = new Map<string, string>();

    for (const field of oldFields || []) {
      const fieldId = String(field?.id || '').trim();
      const fieldKey = String(field?.fieldKey || field?.name || '').trim();
      if (fieldId) oldById.set(fieldId, field);
      if (fieldId && fieldKey && !idByFieldKey.has(fieldKey)) idByFieldKey.set(fieldKey, fieldId);
    }

    // Resolve each new field's id first (id -> fieldKey match; never positional,
    // which is what previously let a reordered field inherit another's metadata).
    const resolved = (newFields || []).map((field) => {
      const next = { ...field };
      const fieldKey = String(next.fieldKey || next.name || '').trim();
      let fieldId = String(next.id || '').trim();
      if (!fieldId && fieldKey) fieldId = idByFieldKey.get(fieldKey) || '';
      if (fieldId) next.id = fieldId;
      return next;
    });

    // Authoritative ownership of identity keys (id, fieldKey, name + normalized
    // variants) so a field's dataKeys can never retain a key that belongs to a
    // different field.
    const ownerByKey = new Map<string, string>();
    const normalize = (value: string) => this.dynamicFieldsService.normalizeFieldAlias(value);
    for (const field of resolved) {
      const fieldId = String(field.id || '').trim();
      if (!fieldId) continue;
      for (const raw of [fieldId, field.fieldKey, field.name]) {
        const key = String(raw || '').trim();
        if (!key) continue;
        if (!ownerByKey.has(key)) ownerByKey.set(key, fieldId);
        const normalized = normalize(key);
        if (normalized && !ownerByKey.has(normalized)) ownerByKey.set(normalized, fieldId);
      }
    }

    const isOwnedByOther = (key: string, fieldId: string) => {
      const owner = ownerByKey.get(key) ?? ownerByKey.get(normalize(key));
      return !!owner && owner !== fieldId;
    };

    return resolved.map((next) => {
      const fieldId = String(next.id || '').trim();
      const oldField = fieldId ? oldById.get(fieldId) : undefined;

      const candidates = [
        ...(Array.isArray(oldField?.dataKeys) ? oldField.dataKeys : []),
        ...(Array.isArray(next.dataKeys) ? next.dataKeys : []),
        oldField?.fieldKey,
        oldField?.name,
        next.fieldKey,
        next.name,
        fieldId,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

      const dataKeys = new Set<string>();
      for (const key of candidates) {
        // Keep the key only when it is unowned or owned by this same field.
        if (isOwnedByOther(key, fieldId)) continue;
        dataKeys.add(key);
      }

      next.dataKeys = [...dataKeys];
      return next;
    });
  }

  private sanitizeSchemaFields(fields: any[]): any[] {
    return fields.map((field) => {
      if (!field || typeof field !== 'object' || Array.isArray(field)) {
        return field;
      }

      const rest = { ...field };
      for (const key of Object.keys(rest)) {
        if (/^field[_]?type[_]?id$/i.test(key)) {
          delete rest[key];
        }
      }

      delete rest.isSystemDefault;

      if (!Object.prototype.hasOwnProperty.call(rest, 'isSystemField')) {
        rest.isSystemField = false;
      }

      if (!rest.isSystemField) {
        rest.systemMappingKey = null;
      }

      if (rest.layoutConfig && typeof rest.layoutConfig === 'object') {
        if (!Object.prototype.hasOwnProperty.call(rest, 'isShow') && typeof rest.layoutConfig.isShow === 'boolean') {
          rest.isShow = rest.layoutConfig.isShow;
        }
        if (rest.layoutConfig.optionSource !== undefined) {
          rest.optionSource = rest.layoutConfig.optionSource;
        }
      }

      if (!Object.prototype.hasOwnProperty.call(rest, 'isShow')) {
        rest.isShow = true;
      }

      this.normalizeImageField(rest);
      return rest;
    });
  }

  /**
   * Image fields store builder reference/examples on `referenceImages` (array of
   * upload meta from purpose=reference). Supports `multiple` / `minFiles` /
   * `maxFiles`. User answers are an array (or single object migrated to array
   * by FE) under the field id in entity_dynamic_data — never compared.
   */
  private normalizeImageField(field: Record<string, any>): void {
    const type = String(field.fieldTypeName || field.type || '')
      .trim()
      .toLowerCase();
    if (type !== 'image') return;

    field.type = 'image';
    field.fieldTypeName = 'image';

    field.referenceImages = this.normalizeReferenceImages(field);

    if (typeof field.multiple !== 'boolean') {
      field.multiple =
        Array.isArray(field.referenceImages) && field.referenceImages.length > 1
          ? true
          : false;
    }

    if (field.minFiles === undefined || field.minFiles === null || field.minFiles === '') {
      field.minFiles = field.multiple ? 1 : null;
    } else {
      field.minFiles = Math.max(0, Number(field.minFiles) || 0);
    }

    if (field.maxFiles === undefined || field.maxFiles === null || field.maxFiles === '') {
      field.maxFiles = field.multiple ? 5 : 1;
    } else {
      field.maxFiles = Math.max(1, Number(field.maxFiles) || 1);
    }

    if (!field.multiple) {
      field.maxFiles = 1;
    } else if (field.minFiles != null && field.maxFiles < field.minFiles) {
      field.maxFiles = field.minFiles;
    }
  }

  private normalizeReferenceImages(field: Record<string, any>): any[] {
    if (Array.isArray(field.referenceImages)) {
      return field.referenceImages.filter(
        (item) => item !== undefined && item !== null && item !== '',
      );
    }

    if (field.referenceImage !== undefined && field.referenceImage !== null && field.referenceImage !== '') {
      return Array.isArray(field.referenceImage)
        ? field.referenceImage.filter((item) => item !== undefined && item !== null && item !== '')
        : [field.referenceImage];
    }

    const legacy =
      field.defaultValue !== undefined && field.defaultValue !== null
        ? field.defaultValue
        : field.value !== undefined && field.value !== null
          ? field.value
          : null;

    if (legacy === null || legacy === '') return [];
    return Array.isArray(legacy) ? legacy.filter(Boolean) : [legacy];
  }

  private sanitizeSchemaSnapshot(schema?: Record<string, any> | null): Record<string, any> {
    const draft = schema || {};
    return {
      ...draft,
      fields: this.sanitizeSchemaFields(Array.isArray(draft.fields) ? draft.fields : []),
    };
  }

  private normalizeSchemaSnapshot(form: Form & { module?: DynamicModule | null }, schema?: Record<string, any> | null): Record<string, any> {
    const draft = this.sanitizeSchemaSnapshot(schema);
    const { fields } = this.repairIdentityFieldsReadonly(
      Array.isArray(draft.fields) ? draft.fields : [],
    );
    return {
      ...draft,
      form: {
        ...(draft.form || {}),
        id: form.id,
        moduleId: form.moduleId,
        moduleSlug: form.module?.slug,
        name: form.name,
        status: form.status,
        type: resolveFormBuilderModuleType(form.module?.slug),
      },
      fields,
    };
  }

  private assertSchemaPayload(schema: Record<string, any>) {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      throw new BadRequestException('schema must be an object');
    }
    const fields = Array.isArray(schema.fields) ? schema.fields : [];

    const fieldKeys = new Set<string>();

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (!field || typeof field !== 'object') {
        throw new BadRequestException(`fields[${i}] must be an object`);
      }

      const key = String(field.fieldKey || field.name || '').trim();
      if (!key) {
        throw new BadRequestException(`fields[${i}] must include fieldKey or name`);
      }

      if (fieldKeys.has(key)) {
        throw new BadRequestException(`Duplicate field key detected: ${key}`);
      }
      fieldKeys.add(key);

      if (typeof field.label !== 'string' || !field.label.trim()) {
        throw new BadRequestException(`fields[${i}].label is required`);
      }

      const validations = Array.isArray(field.validations) ? field.validations : [];
      for (let j = 0; j < validations.length; j++) {
        const validation = validations[j];
        if (!validation || typeof validation !== 'object') {
          throw new BadRequestException(`fields[${i}].validations[${j}] must be an object`);
        }
        if (typeof validation.ruleType !== 'string' || !validation.ruleType.trim()) {
          throw new BadRequestException(`fields[${i}].validations[${j}].ruleType is required`);
        }
      }
    }

    return;
  }

  private async bootstrapDefaultFields(
    req: any,
    form: Form,
    defaultFields: readonly FormBuilderFieldSeed[],
  ): Promise<void> {
    const formRepo = req.tenantConnection.getRepository(Form);
    const existing = form.autosaveSchema || {};

    const logo = this.resolveLogoReference(req);
    const fields = defaultFields.map((item, index) => {
      if (item.type === 'image') {
        return this.mapImageSeedToSchema(item, index, logo);
      }
      return {
        id: item.id,
        fieldKey: item.key,
        label: item.label,
        name: item.name,
        fieldTypeName: item.type,
        placeholder: item.placeholder ?? 'Placeholder text',
        helpText: item.helpText ?? null,
        isRequired: item.isRequired ?? false,
        isUnique: item.isUnique ?? false,
        // isEditable=false locks the field in form builder (cannot delete).
        // isReadonly controls fillability on create/edit forms.
        isEditable: item.isEditable ?? true,
        isReadonly: false,
        isSystemField: item.isSystemField ?? false,
        systemMappingKey: item.isSystemField ? (item.systemMappingKey ?? item.key) : null,
        isShow: item.isShow ?? true,
        ...(item.optionSource ? { optionSource: item.optionSource } : {}),
        ...(item.type === 'dropdown' || item.options?.length
          ? {
              options: (item.options ?? []).map((option, sortOrder) => ({
                label: option.label,
                value: option.value,
                isDefault: option.isDefault ?? false,
                sortOrder,
              })),
            }
          : {}),
      };
    });

    const newSchema = {
      ...existing,
      fields,
    };

    form.autosaveSchema = newSchema;
    await formRepo.save(form);
  }

  async getModules(req: any) {
    await this.ensureCoreModules(req);
    const repo = req.tenantConnection.getRepository(DynamicModule);
    const data = (await repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    })).map((module) => this.withModuleType(module));

    return { success: true, count: data.length, data };
  }

  async bootstrapByModuleSlug(req: any, slug: string) {
    await this.ensureCoreModules(req);

    const moduleRepo = req.tenantConnection.getRepository(DynamicModule);
    const formRepo = req.tenantConnection.getRepository(Form);

    const moduleEntity = await moduleRepo.findOne({ where: { slug } });
    if (!moduleEntity) {
      throw new NotFoundException(`Module with slug ${slug} not found`);
    }

    let form = await formRepo.findOne({
      where: { moduleId: moduleEntity.id },
      order: { createdAt: 'DESC' },
    });

    if (form) {
      form = await this.ensureFormFieldIds(req, form, slug);

      const versionRepo = req.tenantConnection.getRepository(FormVersion);
      const activeVersion = await versionRepo.findOne({
        where: { formId: form.id, isActive: true },
        order: { versionNumber: 'DESC' },
      });

      if (activeVersion?.schemaSnapshot) {
        const rawFields = Array.isArray(activeVersion.schemaSnapshot.fields)
          ? activeVersion.schemaSnapshot.fields
          : [];
        const { fields, changed } = this.repairIdentityFieldsReadonly(rawFields);
        if (changed) {
          activeVersion.schemaSnapshot = {
            ...activeVersion.schemaSnapshot,
            fields,
          };
          await versionRepo.save(activeVersion);
        }

        return {
          success: true,
          data: this.normalizeSchemaSnapshot(
            form as Form & { module?: DynamicModule | null },
            activeVersion.schemaSnapshot,
          ),
        };
      }

      if (form.autosaveSchema) {
        return {
          success: true,
          data: this.normalizeSchemaSnapshot(
            form as Form & { module?: DynamicModule | null },
            form.autosaveSchema,
          ),
        };
      }

      const snapshot = await this.buildRuntimeSnapshot(req, form.id);
      return { success: true, data: snapshot };
    }

    const actor = this.getActorId(req);

    form = await formRepo.save(
      formRepo.create({
        moduleId: moduleEntity.id,
        name: `${moduleEntity.name} Form`,
        status: FormStatus.DRAFT,
        autosaveSchema: null,
        createdBy: actor,
        updatedBy: actor,
      }),
    );

    const moduleSeed = this.moduleSeedBySlug.get(slug);
    if (moduleSeed?.defaultFields?.length) {
      await this.bootstrapDefaultFields(req, form, moduleSeed.defaultFields);
    }

    await this.auditLogService.log(req, {
      entityType: 'form',
      entityId: form.id,
      action: 'bootstrap',
      newValue: { moduleSlug: slug },
      createdBy: actor,
    });

    const versionRepo = req.tenantConnection.getRepository(FormVersion);
    const activeVersion = await versionRepo.findOne({
      where: { formId: form.id, isActive: true },
      order: { versionNumber: 'DESC' },
    });

    if (activeVersion?.schemaSnapshot) {
      return {
        success: true,
        data: this.normalizeSchemaSnapshot(form as Form & { module?: DynamicModule | null }, activeVersion.schemaSnapshot),
      };
    }

    if (form.autosaveSchema) {
      return {
        success: true,
        data: this.normalizeSchemaSnapshot(form as Form & { module?: DynamicModule | null }, form.autosaveSchema),
      };
    }

    const snapshot = await this.buildRuntimeSnapshot(req, form.id);
    return { success: true, data: snapshot };
  }

  async create(req: any, dto: CreateFormDto) {
    const moduleRepo = req.tenantConnection.getRepository(DynamicModule);
    const moduleEntity = await moduleRepo.findOne({
      where: { id: dto.moduleId },
    });

    if (!moduleEntity) {
      throw new NotFoundException('Module not found for tenant');
    }

    const repo = req.tenantConnection.getRepository(Form);
    const actor = this.getActorId(req, dto.createdBy || null);

    const data = await repo.save(
      repo.create({
        moduleId: dto.moduleId,
        name: dto.name,
        status: FormStatus.DRAFT,
        createdBy: actor,
        updatedBy: actor,
      }),
    );
    data.module = moduleEntity;

    await this.auditLogService.log(req, {
      entityType: 'form',
      entityId: data.id,
      action: 'create',
      newValue: data as any,
      createdBy: actor,
    });

    return { success: true, message: 'Form created successfully', data: this.withFormType(data) };
  }

  async findAll(req: any) {
    const repo = req.tenantConnection.getRepository(Form);
    const data = (await repo.find({
      relations: ['module'],
      order: { createdAt: 'DESC' },
    })).map((form) => this.withFormType(form));
    return { success: true, count: data.length, data };
  }

  async findOne(req: any, id: number) {
    const repo = req.tenantConnection.getRepository(Form);
    let data = await repo.findOne({ where: { id }, relations: ['module'] });
    if (!data) {
      throw new NotFoundException('Form not found');
    }

    if (data.module?.slug) {
      data = await this.ensureFormFieldIds(req, data, data.module.slug);
    }

    return { success: true, data: this.withFormType(data) };
  }

  async update(req: any, id: number, dto: UpdateFormDto) {
    const repo = req.tenantConnection.getRepository(Form);
    const entity = await repo.findOne({ where: { id }, relations: ['module'] });
    if (!entity) {
      throw new NotFoundException('Form not found');
    }

    const oldValue = { ...entity } as any;
    entity.name = dto.name ?? entity.name;
    entity.updatedBy = this.getActorId(req, dto.updatedBy || null);

    const data = await repo.save(entity);
    await this.auditLogService.log(req, {
      entityType: 'form',
      entityId: entity.id,
      action: 'update',
      oldValue,
      newValue: data as any,
      createdBy: this.getActorId(req),
    });

    return { success: true, message: 'Form updated successfully', data: this.withFormType(data) };
  }

  async remove(req: any, id: number) {
    const repo = req.tenantConnection.getRepository(Form);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Form not found');
    }

    await repo.softDelete({ id });
    await this.auditLogService.log(req, {
      entityType: 'form',
      entityId: entity.id,
      action: 'soft_delete',
      oldValue: entity as any,
      createdBy: this.getActorId(req),
    });

    return { success: true, message: 'Form deleted successfully', deletedId: id };
  }

  async bulkRemove(req: any, ids: number[]) {
    const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
    if (!uniqueIds.length) {
      throw new BadRequestException('At least one valid ID is required');
    }

    const repo = req.tenantConnection.getRepository(Form);
    const entities = await repo.findBy({ id: In(uniqueIds) });
    const foundIds = entities.map((entity) => entity.id);
    const missingIds = uniqueIds.filter((id) => !foundIds.includes(id));

    if (missingIds.length) {
      throw new NotFoundException(`Forms not found for IDs: ${missingIds.join(', ')}`);
    }

    await repo.softDelete({ id: In(foundIds) });

    const actorId = this.getActorId(req);
    for (const entity of entities) {
      await this.auditLogService.log(req, {
        entityType: 'form',
        entityId: entity.id,
        action: 'soft_delete',
        oldValue: entity as any,
        createdBy: actorId,
      });
    }

    return {
      success: true,
      message: `${foundIds.length} form(s) deleted successfully`,
      data: { deletedIds: foundIds, count: foundIds.length },
    };
  }

  async saveSchema(req: any, id: number, dto: SaveSchemaDto) {
    const repo = req.tenantConnection.getRepository(Form);
    const entity = await repo.findOne({ where: { id }, relations: ['module'] });
    if (!entity) {
      throw new NotFoundException('Form not found');
    }

    this.assertSchemaPayload(dto.schema);
    const oldSchema = this.normalizeSchemaSnapshot(
      entity as Form & { module?: DynamicModule | null },
      entity.autosaveSchema,
    );
    const oldFields = Array.isArray(oldSchema.fields) ? oldSchema.fields : [];

    const sanitizedSchema = this.sanitizeSchemaSnapshot(dto.schema);
    sanitizedSchema.fields = this.preserveFieldMetadata(oldFields, sanitizedSchema.fields);
    const { fields: fieldsWithIds } = this.dynamicFieldsService.backfillMissingFieldIds(
      sanitizedSchema.fields,
      entity.module?.slug || '',
    );
    sanitizedSchema.fields = fieldsWithIds;

    const oldStatus = entity.status;

    entity.autosaveSchema = sanitizedSchema;
    const shouldSaveAsDraft = dto.markAsDraft === true;
    entity.status = shouldSaveAsDraft ? FormStatus.DRAFT : FormStatus.PUBLISHED;
    entity.updatedBy = this.getActorId(req, dto.updatedBy || null);

    const data = await repo.save(entity);

    await this.dynamicFieldsService.migrateDynamicDataKeysOnSchemaChange(
      req,
      entity.moduleId,
      oldFields,
      sanitizedSchema.fields,
    );

    await this.auditLogService.log(req, {
      entityType: 'form',
      entityId: entity.id,
      action: 'save_schema',
      oldValue: {
        form: {
          status: oldStatus,
        },
        schema: oldSchema,
      },
      newValue: {
        form: {
          status: entity.status,
        },
        schema: sanitizedSchema,
      },
      createdBy: this.getActorId(req, dto.updatedBy || null),
    });

    if (!shouldSaveAsDraft) {
      await this.publish(req, id, dto.updatedBy ?? undefined);
    }

    const updatedForm = await repo.findOne({ where: { id }, relations: ['module'] });

    return {
      success: true,
      message: 'Form schema saved successfully',
      data: this.normalizeSchemaSnapshot(
        updatedForm as Form & { module?: DynamicModule | null },
        sanitizedSchema,
      ),
    };
  }

  async publish(req: any, formId: number, updatedBy?: number) {
    await req.tenantConnection.manager.transaction(async (manager) => {
      const formRepo = manager.getRepository(Form);
      const versionRepo = manager.getRepository(FormVersion);

      const form = await formRepo.findOne({ where: { id: formId }, relations: ['module'] });
      if (!form) {
        throw new NotFoundException('Form not found');
      }

      const snapshot = form.autosaveSchema
        ? this.normalizeSchemaSnapshot(form as Form & { module?: DynamicModule | null }, form.autosaveSchema)
        : await this.buildRuntimeSnapshot(req, formId);
      const latest = await versionRepo.findOne({
        where: { formId },
        order: { versionNumber: 'DESC' },
      });

      await versionRepo.update(
        { formId, isActive: true },
        { isActive: false, updatedBy: this.getActorId(req, updatedBy || null) },
      );

      const nextVersion = (latest?.versionNumber || 0) + 1;
      await versionRepo.save(
        versionRepo.create({
          formId,
          versionNumber: nextVersion,
          schemaSnapshot: snapshot,
          isActive: true,
          createdBy: this.getActorId(req, updatedBy || null),
          updatedBy: this.getActorId(req, updatedBy || null),
        }),
      );

      form.status = FormStatus.PUBLISHED;
      form.updatedBy = this.getActorId(req, updatedBy || null);
      await formRepo.save(form);
    });

    await this.auditLogService.log(req, {
      entityType: 'form',
      entityId: formId,
      action: 'publish',
      createdBy: this.getActorId(req, updatedBy || null),
    });

    return { success: true, message: 'Form published successfully' };
  }

}
