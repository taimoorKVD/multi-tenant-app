import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  AutosaveFormDto,
  CreateFormDto,
  CreateSectionDto,
  SaveSchemaDto,
  UpdateFormDto,
  UpdateLayoutDto,
  UpdateSectionDto,
} from '../dto';
import {
  DynamicModule,
  FieldType,
  Form,
  FormField,
  FormSection,
  FormStatus,
  FormVersion,
} from '../entities';
import { AuditLogService } from './audit-log.service';
import { FieldTypesService } from './field-types.service';

@Injectable()
export class FormsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly fieldTypesService: FieldTypesService,
  ) {}

  private getActorId(req: any, fallback?: number | null): number | null {
    const candidate = fallback ?? req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) {
      return null;
    }

    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  private modulesSeed = [
    { slug: 'users', name: 'Users' },
    { slug: 'items', name: 'Items' },
    { slug: 'vendors', name: 'Vendors' },
    { slug: 'job-positions', name: 'Job Positions' },
  ];

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
    const form = await formRepo.findOne({
      where: { id: formId },
      relations: [
        'module',
        'sections',
        'fields',
        'fields.options',
        'fields.validations',
        'conditionalRules',
      ],
      order: {
        sections: { position: 'ASC' },
        fields: { sortOrder: 'ASC' },
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    return {
      form: {
        id: form.id,
        moduleId: form.moduleId,
        moduleSlug: form.module?.slug,
        name: form.name,
        status: form.status,
      },
      sections: (form.sections || []).map((section) => ({
        id: section.id,
        title: section.title,
        position: section.position,
      })),
      fields: (form.fields || []).map((field) => ({
        id: field.id,
        sectionId: field.sectionId,
        fieldTypeName: field.fieldTypeName,
        fieldKey: field.fieldKey,
        label: field.label,
        name: field.name,
        placeholder: field.placeholder,
        helpText: field.helpText,
        isRequired: field.isRequired,
        isUnique: field.isUnique,
        isReadonly: field.isReadonly,
        isSystemDefault: field.isSystemDefault,
        isSystemField: field.isSystemField,
        systemMappingKey: field.systemMappingKey,
        isDeletable: field.isDeletable,
        isEditable: field.isEditable,
        sortOrder: field.sortOrder,
        layoutConfig: field.layoutConfig,
        optionSource:
          field.layoutConfig && typeof field.layoutConfig === 'object'
            ? field.layoutConfig.optionSource || null
            : null,
        options: (field.options || []).map((option) => ({
          id: option.id,
          label: option.label,
          value: option.value,
          isDefault: option.isDefault,
          sortOrder: option.sortOrder,
        })),
        validations: (field.validations || []).map((validation) => ({
          id: validation.id,
          ruleType: validation.ruleType,
          ruleValue: validation.ruleValue,
          errorMessage: validation.errorMessage,
          isActive: validation.isActive,
        })),
      })),
      conditionalRules: (form.conditionalRules || []).map((rule) => ({
        id: rule.id,
        dependentFieldId: rule.dependentFieldId,
        sourceFieldId: rule.sourceFieldId,
        operator: rule.operator,
        comparisonValue: rule.comparisonValue,
        actionType: rule.actionType,
      })),
    };
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

    // const sections = Array.isArray(schema.sections) ? schema.sections : [];
    // const fields = Array.isArray(schema.fields) ? schema.fields : [];
    // const conditionalRules = Array.isArray(schema.conditionalRules) ? schema.conditionalRules : [];

    // const fieldKeys = new Set<string>();

    // for (let i = 0; i < sections.length; i++) {
    //   const section = sections[i];
    //   if (!section || typeof section !== 'object') {
    //     throw new BadRequestException(`sections[${i}] must be an object`);
    //   }

    //   if (typeof section.title !== 'string' || !section.title.trim()) {
    //     throw new BadRequestException(`sections[${i}].title is required`);
    //   }
    // }

    // for (let i = 0; i < fields.length; i++) {
    //   const field = fields[i];
    //   if (!field || typeof field !== 'object') {
    //     throw new BadRequestException(`fields[${i}] must be an object`);
    //   }

    //   const key = String(field.fieldKey || field.name || '').trim();
    //   if (!key) {
    //     throw new BadRequestException(`fields[${i}] must include fieldKey or name`);
    //   }

    //   if (fieldKeys.has(key)) {
    //     throw new BadRequestException(`Duplicate field key detected: ${key}`);
    //   }
    //   fieldKeys.add(key);

    //   if (typeof field.label !== 'string' || !field.label.trim()) {
    //     throw new BadRequestException(`fields[${i}].label is required`);
    //   }

    //   if (field.layoutConfig !== undefined && (typeof field.layoutConfig !== 'object' || Array.isArray(field.layoutConfig))) {
    //     throw new BadRequestException(`fields[${i}].layoutConfig must be an object`);
    //   }

    //   const validations = Array.isArray(field.validations) ? field.validations : [];
    //   for (let j = 0; j < validations.length; j++) {
    //     const validation = validations[j];
    //     if (!validation || typeof validation !== 'object') {
    //       throw new BadRequestException(`fields[${i}].validations[${j}] must be an object`);
    //     }
    //     if (typeof validation.ruleType !== 'string' || !validation.ruleType.trim()) {
    //       throw new BadRequestException(`fields[${i}].validations[${j}].ruleType is required`);
    //     }
    //   }
    // }

    // for (let i = 0; i < conditionalRules.length; i++) {
    //   const rule = conditionalRules[i];
    //   if (!rule || typeof rule !== 'object') {
    //     throw new BadRequestException(`conditionalRules[${i}] must be an object`);
    //   }

    //   const dependentFieldKey = String(rule.dependentFieldKey || '').trim();
    //   const sourceFieldKey = String(rule.sourceFieldKey || '').trim();

    //   if (!dependentFieldKey || !sourceFieldKey) {
    //     throw new BadRequestException(
    //       `conditionalRules[${i}] must include dependentFieldKey and sourceFieldKey`,
    //     );
    //   }

    //   if (!fieldKeys.has(dependentFieldKey) || !fieldKeys.has(sourceFieldKey)) {
    //     throw new BadRequestException(
    //       `conditionalRules[${i}] references fields that do not exist in schema.fields`,
    //     );
    //   }

    //   if (typeof rule.operator !== 'string' || !rule.operator.trim()) {
    //     throw new BadRequestException(`conditionalRules[${i}].operator is required`);
    //   }

    //   if (typeof rule.actionType !== 'string' || !rule.actionType.trim()) {
    //     throw new BadRequestException(`conditionalRules[${i}].actionType is required`);
    //   }
    // }
    
    // Temporarily keep schema validation permissive so drag/drop saves are not blocked
    // by incomplete intermediate payloads from the frontend builder.
    return;
  }

  private async bootstrapUsersDefault(req: any, form: Form): Promise<void> {
    const sectionRepo = req.tenantConnection.getRepository(FormSection);
    const fieldRepo = req.tenantConnection.getRepository(FormField);
    const fieldTypeRepo = req.tenantConnection.getRepository(FieldType);

    await this.fieldTypesService.ensureSeeded(req);
    const fieldTypes = await fieldTypeRepo.find();
    const typeByName = new Map<string, FieldType>(
      fieldTypes.map((fieldType) => [fieldType.name, fieldType]),
    );

    const actor = this.getActorId(req);

    const contactInfoSection = await sectionRepo.save(
      sectionRepo.create({
        formId: form.id,
        title: 'Contact Info',
        position: 0,
        createdBy: actor,
        updatedBy: actor,
      }),
    );

    const availabilitySection = await sectionRepo.save(
      sectionRepo.create({
        formId: form.id,
        title: 'Availability',
        position: 1,
        createdBy: actor,
        updatedBy: actor,
      }),
    );


    // Default system fields exposed to the form builder for tenant user management.
    // Keep this focused on operational fields and avoid exposing internal/sensitive columns.
    const systemFields = [
      { key: 'name', label: 'Name', name: 'name', type: 'text', isEditable: true },
      { key: 'email', label: 'Email', name: 'email', type: 'email', isEditable: true },
      { key: 'phone_number', label: 'Phone Number', name: 'phone_number', type: 'phone', isEditable: true },
      { key: 'address', label: 'Address', name: 'address', type: 'address_fields', isEditable: true },
      { key: 'username', label: 'Username', name: 'username', type: 'text', isEditable: true },
      { key: 'password', label: 'Password', name: 'password', type: 'password', isEditable: true },
      {
        key: 'role_id',
        label: 'Role',
        name: 'role_id',
        type: 'dropdown',
        isEditable: true,
        optionSource: {
          type: 'api',
          request: {
            method: 'GET',
            endpoint: '/api/roles',
          },
          response: {
            dataPath: 'data',
            labelKey: 'name',
            valueKey: 'id',
          },
        },
      },
      {
        key: 'job_position_id',
        label: 'Job Position',
        name: 'job_position_id',
        type: 'dropdown',
        isEditable: true,
        optionSource: {
          type: 'api',
          request: {
            method: 'GET',
            endpoint: '/api/job-positions',
          },
          response: {
            dataPath: 'data',
            labelKey: 'name',
            valueKey: 'id',
          },
        },
      },
      {
        key: 'location_id',
        label: 'Location',
        name: 'location_id',
        type: 'dropdown',
        isEditable: true,
        optionSource: {
          type: 'api',
          request: {
            method: 'GET',
            endpoint: '/api/locations',
          },
          response: {
            dataPath: 'data',
            labelKey: 'name',
            valueKey: 'id',
          },
        },
      },
      { key: 'availability_days', label: 'Availability Days', name: 'availability_days', type: 'checkbox', isEditable: true },
    ];

    const fields = systemFields.map((item, index) => {
      const fieldType = typeByName.get(item.type);
      if (!fieldType) {
        throw new BadRequestException(`Missing field type: ${item.type}`);
      }
      return fieldRepo.create({
        formId: form.id,
        sectionId: item.key === 'availability_days' ? availabilitySection.id : contactInfoSection.id,
        fieldTypeName: fieldType.name,
        fieldKey: item.key,
        label: item.label,
        name: item.name,
        placeholder: 'Placeholder text',
        helpText: null,
        isRequired: ['name', 'email', 'password', 'role_id'].includes(item.key),
        isUnique: ['email', 'username'].includes(item.key),
        isReadonly: !item.isEditable,
        isSystemDefault: true,
        isSystemField: true,
        systemMappingKey: item.key,
        isDeletable: false,
        isEditable: item.isEditable,
        sortOrder: index,
        layoutConfig: {
          grid_width_desktop: 6,
          grid_width_mobile: 12,
          ...(item.optionSource ? { optionSource: item.optionSource } : {}),
        },
        ...(item.key === 'availability_days'
          ? {
              options: [
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
                'Sunday',
              ].map((day, sortOrder) => ({
                label: day,
                value: day.toLowerCase(),
                isDefault: false,
                sortOrder,
                createdBy: actor,
                updatedBy: actor,
              })),
            }
          : {}),
        createdBy: actor,
        updatedBy: actor,
      });
    });

    await fieldRepo.save(fields);
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
    await this.fieldTypesService.ensureSeeded(req);

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
      return this.getRuntimeSchema(req, form.id);
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

    if (slug === 'users') {
      await this.bootstrapUsersDefault(req, form);
    }

    await this.auditLogService.log(req, {
      entityType: 'form',
      entityId: form.id,
      action: 'bootstrap',
      newValue: { moduleSlug: slug },
      createdBy: actor,
    });

    return this.getRuntimeSchema(req, form.id);
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

  async autosave(req: any, id: number, dto: AutosaveFormDto) {
    const repo = req.tenantConnection.getRepository(Form);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Form not found');
    }

    entity.autosaveSchema = dto.schema;
    entity.updatedBy = this.getActorId(req, dto.updatedBy || null);

    const data = await repo.save(entity);
    return { success: true, message: 'Form autosaved', data };
  }

  async saveSchema(req: any, id: number, dto: SaveSchemaDto) {
    const repo = req.tenantConnection.getRepository(Form);
    const entity = await repo.findOne({ where: { id }, relations: ['module'] });
    if (!entity) {
      throw new NotFoundException('Form not found');
    }

    this.assertSchemaPayload(dto.schema);
    const sanitizedSchema = this.sanitizeSchemaSnapshot(dto.schema);

    entity.autosaveSchema = sanitizedSchema;
    if (dto.markAsDraft !== false) {
      entity.status = FormStatus.DRAFT;
    }
    entity.updatedBy = this.getActorId(req, dto.updatedBy || null);

    const data = await repo.save(entity);

    await this.auditLogService.log(req, {
      entityType: 'form',
      entityId: entity.id,
      action: 'save_schema',
      newValue: {
        fieldsCount: Array.isArray(sanitizedSchema?.fields) ? sanitizedSchema.fields.length : 0,
        sectionsCount: Array.isArray(sanitizedSchema?.sections) ? sanitizedSchema.sections.length : 0,
      },
      createdBy: this.getActorId(req, dto.updatedBy || null),
    });

    return {
      success: true,
      message: 'Form schema saved successfully',
      data: this.normalizeSchemaSnapshot(data as Form & { module?: DynamicModule | null }, data.autosaveSchema),
    };
  }

  async createSection(req: any, formId: number, dto: CreateSectionDto) {
    const formRepo = req.tenantConnection.getRepository(Form);
    const form = await formRepo.findOne({ where: { id: formId } });
    if (!form) throw new NotFoundException('Form not found');

    const sectionRepo = req.tenantConnection.getRepository(FormSection);
    const data = await sectionRepo.save(
      sectionRepo.create({
        formId,
        title: dto.title,
        position: dto.position ?? 0,
        createdBy: this.getActorId(req, dto.createdBy || null),
        updatedBy: this.getActorId(req, dto.createdBy || null),
      }),
    );

    return { success: true, message: 'Section created successfully', data };
  }

  async updateSection(req: any, id: number, dto: UpdateSectionDto) {
    const repo = req.tenantConnection.getRepository(FormSection);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Section not found');

    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.position !== undefined) entity.position = dto.position;
    entity.updatedBy = this.getActorId(req, dto.updatedBy || null);

    const data = await repo.save(entity);
    return { success: true, message: 'Section updated successfully', data };
  }

  async deleteSection(req: any, id: number) {
    const repo = req.tenantConnection.getRepository(FormSection);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Section not found');

    await repo.softDelete({ id });
    return { success: true, message: 'Section deleted successfully', deletedId: id };
  }

  async updateLayout(req: any, formId: number, dto: UpdateLayoutDto) {
    const formRepo = req.tenantConnection.getRepository(Form);
    const fieldRepo = req.tenantConnection.getRepository(FormField);

    const form = await formRepo.findOne({ where: { id: formId } });
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    const actor = this.getActorId(req, dto.updatedBy || null);

    await req.tenantConnection.manager.transaction(async (manager) => {
      const repo = manager.getRepository(FormField);
      for (const item of dto.fields) {
        const field = await repo.findOne({ where: { id: item.fieldId, formId } });
        if (!field) {
          throw new NotFoundException(`Field ${item.fieldId} not found`);
        }

        field.sectionId = item.sectionId ?? null;
        field.sortOrder = item.sortOrder;
        field.layoutConfig = {
          grid_width_desktop: item.gridWidthDesktop,
          grid_width_mobile: item.gridWidthMobile,
        };
        field.updatedBy = actor;
        await repo.save(field);
      }
    });

    const data = await fieldRepo.find({
      where: { formId },
      order: { sortOrder: 'ASC' },
    });

    await this.auditLogService.log(req, {
      entityType: 'form_layout',
      entityId: formId,
      action: 'bulk_layout_update',
      newValue: { fieldsCount: dto.fields.length, meta: dto.meta || null },
      createdBy: actor,
    });

    return { success: true, message: 'Layout updated successfully', data };
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

  async getRuntimeSchema(req: any, formId: number) {
    const formRepo = req.tenantConnection.getRepository(Form);
    const versionRepo = req.tenantConnection.getRepository(FormVersion);

    const form = await formRepo.findOne({ where: { id: formId }, relations: ['module'] });
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    const activeVersion = await versionRepo.findOne({
      where: { formId, isActive: true },
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

    const snapshot = await this.buildRuntimeSnapshot(req, formId);
    return { success: true, data: snapshot };
  }
}
