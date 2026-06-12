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
import { FORM_BUILDER_MODULE_SEEDS, FormBuilderFieldSeed } from '../config/module-seeds';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class FormsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
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
    const schema = form.autosaveSchema || { sections: [], fields: [], conditionalRules: [] };

    return this.normalizeSchemaSnapshot(form as Form & { module?: DynamicModule | null }, schema);
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

      if (!Object.prototype.hasOwnProperty.call(rest, 'isShow')) {
        rest.isShow = true;
      }
      return rest;
    });
  }

  private sanitizeSchemaSnapshot(schema?: Record<string, any> | null): Record<string, any> {
    const draft = schema || {};
    return {
      ...draft,
      sections: Array.isArray(draft.sections) ? draft.sections : [],
      fields: this.sanitizeSchemaFields(Array.isArray(draft.fields) ? draft.fields : []),
      conditionalRules: Array.isArray(draft.conditionalRules) ? draft.conditionalRules : [],
    };
  }

  private normalizeSchemaSnapshot(form: Form & { module?: DynamicModule | null }, schema?: Record<string, any> | null): Record<string, any> {
    const draft = this.sanitizeSchemaSnapshot(schema);
    return {
      ...draft,
      form: {
        ...(draft.form || {}),
        id: form.id,
        moduleId: form.moduleId,
        moduleSlug: form.module?.slug,
        name: form.name,
        status: form.status,
      },
      sections: draft.sections,
      fields: draft.fields,
      conditionalRules: draft.conditionalRules,
    };
  }

  private assertSchemaPayload(schema: Record<string, any>) {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      throw new BadRequestException('schema must be an object');
    }
    const sections = Array.isArray(schema.sections) ? schema.sections : [];
    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    const conditionalRules = Array.isArray(schema.conditionalRules) ? schema.conditionalRules : [];

    const fieldKeys = new Set<string>();

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (!section || typeof section !== 'object') {
        throw new BadRequestException(`sections[${i}] must be an object`);
      }

      if (typeof section.title !== 'string' || !section.title.trim()) {
        throw new BadRequestException(`sections[${i}].title is required`);
      }
    }

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

      if (field.layoutConfig !== undefined && (typeof field.layoutConfig !== 'object' || Array.isArray(field.layoutConfig))) {
        throw new BadRequestException(`fields[${i}].layoutConfig must be an object`);
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

    for (let i = 0; i < conditionalRules.length; i++) {
      const rule = conditionalRules[i];
      if (!rule || typeof rule !== 'object') {
        throw new BadRequestException(`conditionalRules[${i}] must be an object`);
      }

      const dependentFieldKey = String(rule.dependentFieldKey || '').trim();
      const sourceFieldKey = String(rule.sourceFieldKey || '').trim();

      if (!dependentFieldKey || !sourceFieldKey) {
        throw new BadRequestException(
          `conditionalRules[${i}] must include dependentFieldKey and sourceFieldKey`,
        );
      }

      if (!fieldKeys.has(dependentFieldKey) || !fieldKeys.has(sourceFieldKey)) {
        throw new BadRequestException(
          `conditionalRules[${i}] references fields that do not exist in schema.fields`,
        );
      }

      if (typeof rule.operator !== 'string' || !rule.operator.trim()) {
        throw new BadRequestException(`conditionalRules[${i}].operator is required`);
      }

      if (typeof rule.actionType !== 'string' || !rule.actionType.trim()) {
        throw new BadRequestException(`conditionalRules[${i}].actionType is required`);
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

    const fields = defaultFields.map((item, index) => ({
      fieldKey: item.key,
      label: item.label,
      name: item.name,
      fieldTypeName: item.type,
      placeholder: item.placeholder ?? 'Placeholder text',
      helpText: item.helpText ?? null,
      isRequired: item.isRequired ?? false,
      isUnique: item.isUnique ?? false,
      isReadonly: !(item.isEditable ?? true),
      isSystemField: item.isSystemField ?? false,
      systemMappingKey: item.isSystemField ? (item.systemMappingKey ?? item.key) : null,
      isDeletable: false,
      isEditable: item.isEditable ?? true,
      sortOrder: index,
      layoutConfig: {
        grid_width_desktop: 6,
        grid_width_mobile: 12,
        isShow: item.isShow ?? true,
        ...(item.optionSource ? { optionSource: item.optionSource } : {}),
      },
      ...(item.options?.length
        ? {
            options: item.options.map((option, sortOrder) => ({
              label: option.label,
              value: option.value,
              isDefault: option.isDefault ?? false,
              sortOrder,
            })),
          }
        : {}),
    }));

    const newSchema = {
      ...(existing || {}),
      sections: Array.isArray(existing.sections) ? existing.sections : [],
      fields,
      conditionalRules: Array.isArray(existing.conditionalRules) ? existing.conditionalRules : [],
    };

    form.autosaveSchema = newSchema;
    await formRepo.save(form);
  }

  async getModules(req: any) {
    await this.ensureCoreModules(req);
    const repo = req.tenantConnection.getRepository(DynamicModule);
    const data = await repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

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

    await this.auditLogService.log(req, {
      entityType: 'form',
      entityId: data.id,
      action: 'create',
      newValue: data as any,
      createdBy: actor,
    });

    return { success: true, message: 'Form created successfully', data };
  }

  async findAll(req: any) {
    const repo = req.tenantConnection.getRepository(Form);
    const data = await repo.find({
      relations: ['module'],
      order: { createdAt: 'DESC' },
    });
    return { success: true, count: data.length, data };
  }

  async findOne(req: any, id: number) {
    const repo = req.tenantConnection.getRepository(Form);
    const data = await repo.findOne({ where: { id }, relations: ['module'] });
    if (!data) {
      throw new NotFoundException('Form not found');
    }

    return { success: true, data };
  }

  async update(req: any, id: number, dto: UpdateFormDto) {
    const repo = req.tenantConnection.getRepository(Form);
    const entity = await repo.findOne({ where: { id } });
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

    return { success: true, message: 'Form updated successfully', data };
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

  async saveSchema(req: any, id: number, dto: SaveSchemaDto) {
    const repo = req.tenantConnection.getRepository(Form);
    const entity = await repo.findOne({ where: { id }, relations: ['module'] });
    if (!entity) {
      throw new NotFoundException('Form not found');
    }

    this.assertSchemaPayload(dto.schema);
    const sanitizedSchema = this.sanitizeSchemaSnapshot(dto.schema);

    const oldSchema = this.normalizeSchemaSnapshot(entity as Form & { module?: DynamicModule | null }, entity.autosaveSchema);
    const oldStatus = entity.status;

    entity.autosaveSchema = sanitizedSchema;
    const shouldSaveAsDraft = dto.markAsDraft === true;
    entity.status = shouldSaveAsDraft ? FormStatus.DRAFT : FormStatus.PUBLISHED;
    entity.updatedBy = this.getActorId(req, dto.updatedBy || null);

    const data = await repo.save(entity);

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
