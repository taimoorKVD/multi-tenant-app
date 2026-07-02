import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, Not, Repository } from 'typeorm';
import { DynamicModule, Form, FormVersion } from '../form-builder/entities';
import { EntityDynamicData } from '../form-builder/entities/entity-dynamic-data.entity';
import { TenantAbstractService } from '../../common/abstract';
import { Role } from '../role/entities';
import { SendUserCredentialsDto } from './dto';
import { MailService } from '../../mail/mail.service';
import { User } from './entities';

@Injectable()
export class UsersService extends TenantAbstractService<User> {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {
    super(dataSource.getRepository(User));
  }

  private readonly usersModuleSlug = 'users';

  private readonly fallbackSystemFieldKeys = new Set([
    'id',
    'name',
    'email',
    'password',
    'plain_password',
    'role_id',
    'is_system',
    'created_at',
    'updated_at',
  ]);

  private readonly ignoredPayloadKeys = new Set(['password_confirm', 'createdBy', 'updatedBy']);

  private readonly relationFieldAliases: Record<string, string> = {
    role: 'role_id',
  };

  private getFrontendBaseUrl(): string {
    const frontendUrl = process.env.FRONTEND_URL?.trim() || process.env.APP_FRONTEND_URL?.trim();
    if (frontendUrl) {
      return frontendUrl.replace(/\/+$/, '');
    }

    return 'http://localhost:4200';
  }

  private getTenantLoginUrl(): string {
    return `${this.getFrontendBaseUrl()}/tenant/login`;
  }

  private getActorId(req: any): number | null {
    const actorId = req?.user?.id ?? req?.user?.sub ?? req?.user?.userId ?? null;
    return typeof actorId === 'number' ? actorId : Number.isFinite(Number(actorId)) ? Number(actorId) : null;
  }

  private async getUsersSchemaContext(req: any): Promise<{
    moduleId: number | null;
    formId: number | null;
    activeVersionId: number | null;
    systemFieldKeys: Set<string>;
    requiredFieldKeys: Set<string>;
    fieldLabels: Map<string, string>;
    aliasToCanonicalMap: Map<string, string>;
    fieldDefinitions: Map<string, { fieldType: string; options: Array<{ label: string; value: string }> }>;
  }> {
    const moduleRepo = req.tenantConnection.getRepository(DynamicModule);
    const formRepo = req.tenantConnection.getRepository(Form);
    const versionRepo = req.tenantConnection.getRepository(FormVersion);

    const module = await moduleRepo.findOne({ where: { slug: this.usersModuleSlug } });
    if (!module) {
      return {
        moduleId: null,
        formId: null,
        activeVersionId: null,
        systemFieldKeys: new Set(this.fallbackSystemFieldKeys),
        requiredFieldKeys: new Set(),
        fieldLabels: new Map(),
        aliasToCanonicalMap: new Map(),
        fieldDefinitions: new Map(),
      };
    }

    const form = await formRepo.findOne({
      where: { moduleId: module.id },
      order: { createdAt: 'DESC' },
    });

    if (!form) {
      return {
        moduleId: module.id,
        formId: null,
        activeVersionId: null,
        systemFieldKeys: new Set(this.fallbackSystemFieldKeys),
        requiredFieldKeys: new Set(),
        fieldLabels: new Map(),
        aliasToCanonicalMap: new Map(),
        fieldDefinitions: new Map(),
      };
    }

    const activeVersion = await versionRepo.findOne({ where: { formId: form.id, isActive: true } });

    const systemFieldKeys = new Set<string>();
    const requiredFieldKeys = new Set<string>();
    const fieldLabels = new Map<string, string>();
    const aliasToCanonicalMap = new Map<string, string>();
    const fieldDefinitions = new Map<string, { fieldType: string; options: Array<{ label: string; value: string }> }>();

    const fields = form.autosaveSchema?.fields || [];

    for (const field of fields) {
      const fieldKey = String(field.fieldKey || field.name || '').trim();
      const systemMappingKey = String(field.systemMappingKey || '').trim();
      const canonicalKey =
        field.isSystemField && systemMappingKey ? systemMappingKey : systemMappingKey || fieldKey;
      if (!canonicalKey) continue;

      fieldLabels.set(canonicalKey, String(field.label || canonicalKey).trim() || canonicalKey);

      const normalizedLabel = this.normalizeFieldAlias(field.label || '');
      const normalizedFieldKey = this.normalizeFieldAlias(field.fieldKey || '');
      const normalizedName = this.normalizeFieldAlias(field.name || '');
      const aliases = [
        canonicalKey,
        fieldKey,
        field.name,
        field.label,
        field.id,
        normalizedLabel,
        normalizedFieldKey,
        normalizedName,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

      for (const alias of aliases) {
        aliasToCanonicalMap.set(alias, canonicalKey);
        const normalizedAlias = this.normalizeFieldAlias(alias);
        if (normalizedAlias) {
          aliasToCanonicalMap.set(normalizedAlias, canonicalKey);
        }
      }

      if (field.isSystemField) {
        systemFieldKeys.add(canonicalKey);
      }

      if (this.isRequiredField(field)) {
        requiredFieldKeys.add(canonicalKey);
      }

      const fieldType = String(field.fieldTypeName || field.type || '').trim().toLowerCase();
      const options = (Array.isArray(field.options) ? field.options : []).map((option: Record<string, any>) => ({
        label: String(option?.label ?? '').trim(),
        value: String(option?.value ?? '').trim(),
      }));
      const definition = { fieldType, options };
      fieldDefinitions.set(canonicalKey, definition);
      if (fieldKey) {
        fieldDefinitions.set(fieldKey, definition);
      }
    }

    for (const [alias, canonical] of Object.entries(this.relationFieldAliases)) {
      aliasToCanonicalMap.set(alias, canonical);
      aliasToCanonicalMap.set(this.normalizeFieldAlias(alias), canonical);
    }

    this.fallbackSystemFieldKeys.forEach((key) => systemFieldKeys.add(key));

    this.fallbackSystemFieldKeys.forEach((key) => {
      if (!aliasToCanonicalMap.has(key)) {
        aliasToCanonicalMap.set(key, key);
      }

      const normalized = this.normalizeFieldAlias(key);
      if (normalized && !aliasToCanonicalMap.has(normalized)) {
        aliasToCanonicalMap.set(normalized, key);
      }
    });

    return {
      moduleId: module.id,
      formId: form.id,
      activeVersionId: activeVersion?.id ?? null,
      systemFieldKeys,
      requiredFieldKeys,
      fieldLabels,
      aliasToCanonicalMap,
      fieldDefinitions,
    };
  }

  private normalizeFieldAlias(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private isTruthySchemaFlag(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

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
      if (!validation || typeof validation !== 'object') {
        return false;
      }

      return (
        this.isTruthySchemaFlag(validation.isRequired) ||
        this.isTruthySchemaFlag(validation.required) ||
        String(validation.ruleType || validation.type || '')
          .trim()
          .toLowerCase() === 'required'
      );
    });
  }

  private isEmptyRequiredValue(value: any): boolean {
    if (value === undefined || value === null) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim() === '';
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return false;
  }

  private resolvePayloadAliases(
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

  private hasPresentValue(value: unknown): boolean {
    if (value === undefined || value === null) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim() !== '';
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return true;
  }

  private coerceRelationId(value: unknown): number | null {
    if (!this.hasPresentValue(value)) {
      return null;
    }

    if (typeof value === 'object' && value !== null && 'id' in (value as Record<string, unknown>)) {
      const id = Number((value as Record<string, unknown>).id);
      return Number.isFinite(id) ? id : null;
    }

    const id = Number(value);
    return Number.isFinite(id) ? id : null;
  }

  private promoteDynamicSystemFields(
    staticPayload: Record<string, any>,
    dynamicPayload: Record<string, any>,
    aliasToCanonicalMap: Map<string, string>,
    systemFieldKeys: Set<string>,
  ): { staticPayload: Record<string, any>; dynamicPayload: Record<string, any> } {
    const nextStaticPayload = { ...staticPayload };
    const nextDynamicPayload = { ...dynamicPayload };

    for (const [key, value] of Object.entries(dynamicPayload || {})) {
      const normalizedKey = this.normalizeFieldAlias(key);
      const canonicalKey = aliasToCanonicalMap.get(key) || aliasToCanonicalMap.get(normalizedKey) || key;

      if (!systemFieldKeys.has(canonicalKey) || !this.hasPresentValue(value)) {
        continue;
      }

      if (!this.hasPresentValue(nextStaticPayload[canonicalKey])) {
        nextStaticPayload[canonicalKey] = value;
        delete nextDynamicPayload[key];
      }
    }

    return {
      staticPayload: nextStaticPayload,
      dynamicPayload: nextDynamicPayload,
    };
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

      if (systemFieldKeys.has(canonicalKey) || systemFieldKeys.has(key)) {
        continue;
      }

      filtered[key] = value;
    }

    return filtered;
  }

  private splitUserPayload(
    payload: Record<string, any>,
    systemFieldKeys: Set<string>,
  ): { staticPayload: Record<string, any>; dynamicPayload: Record<string, any> } {
    const staticPayload: Record<string, any> = {};
    const dynamicPayload: Record<string, any> = {};

    for (const [key, value] of Object.entries(payload || {})) {
      if (this.ignoredPayloadKeys.has(key)) {
        continue;
      }

      if (systemFieldKeys.has(key)) {
        staticPayload[key] = value;
      } else {
        dynamicPayload[key] = value;
      }
    }

    return { staticPayload, dynamicPayload };
  }

  private assertCreatePayloadRequiredFields(
    payload: Record<string, any>,
    requiredFieldKeys: Set<string>,
    fieldLabels: Map<string, string> = new Map(),
  ): void {
    const missing = Array.from(requiredFieldKeys).filter((key) => {
      const value = payload[key];
      return this.isEmptyRequiredValue(value);
    });

    if (missing.length) {
      throw new BadRequestException({
        message: missing.map((key) => `${fieldLabels.get(key) || key} is required`),
        error: 'Bad Request',
        statusCode: 400,
        fields: missing.reduce(
          (acc, key) => ({
            ...acc,
            [key]: `${fieldLabels.get(key) || key} is required`,
          }),
          {} as Record<string, string>,
        ),
      });
    }

    if (payload.password_confirm !== undefined && payload.password_confirm !== payload.password) {
      throw new BadRequestException('Passwords do not match.');
    }
  }

  private buildRequiredValidationPayload(
    user: User,
    staticPayload: Record<string, any>,
    dynamicPayload: Record<string, any>,
  ): Record<string, any> {
    return {
      name: user.name,
      email: user.email,
      password: user.password,
      plain_password: user.plainPassword,
      role_id: user.role?.id,
      ...staticPayload,
      ...dynamicPayload,
    };
  }

  private async loadUserDynamicRows(
    req: any,
    moduleId: number | null,
    entityIds: number[],
  ): Promise<Map<number, Record<string, any>>> {
    const result = new Map<number, Record<string, any>>();
    if (!moduleId || !entityIds.length) return result;

    const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
    const rows = await dynamicRepo.find({
      where: { moduleId, entityId: In(entityIds) },
    });

    for (const row of rows) {
      result.set(row.entityId, row.data || {});
    }

    return result;
  }

  private async upsertUserDynamicRow(
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

  private formatRole(role: Role | null): Record<string, any> | null {
    if (!role) return null;

    const { createdAt, updatedAt, permissions, ...rest } = role;
    return {
      ...rest,
      ...(permissions ? { permissions } : {}),
      created_at: createdAt,
      updated_at: updatedAt,
    };
  }

  private buildUserResponse(
    user: User,
    dynamicData: Record<string, any> = {},
    schemaContext?: {
      systemFieldKeys: Set<string>;
      aliasToCanonicalMap: Map<string, string>;
    },
  ): Record<string, any> {
    const filteredDynamicData = schemaContext
      ? this.filterDynamicDataForResponse(
          dynamicData,
          schemaContext.aliasToCanonicalMap,
          schemaContext.systemFieldKeys,
        )
      : dynamicData;

    return {
      ...filteredDynamicData,
      id: user.id,
      name: user.name,
      email: user.email,
      plain_password: user.plainPassword ?? null,
      role: this.formatRole(user.role ?? null),
      is_system: user.isSystem,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }

  private async applyStaticPayloadToUser(
    req: any,
    user: User,
    staticPayload: Record<string, any>,
    options: { isCreate?: boolean } = {},
  ): Promise<void> {
    const userRepo = this.getRepo(req);
    const roleRepo: Repository<Role> = req.tenantConnection.getRepository(Role);
    const isCreate = options.isCreate ?? false;

    const shouldApplyScalar = (value: unknown) => isCreate || this.hasPresentValue(value);

    if (shouldApplyScalar(staticPayload.name) && staticPayload.name !== undefined) {
      user.name = staticPayload.name;
    }

    if (staticPayload.email !== undefined && (isCreate || this.hasPresentValue(staticPayload.email))) {
      if (!isCreate && staticPayload.email !== user.email) {
        const existing = await userRepo.findOne({ where: { email: staticPayload.email } });
        if (existing && existing.id !== user.id) {
          throw new BadRequestException('Email already in use by another user.');
        }
      }
      user.email = staticPayload.email;
    }

    if (this.hasPresentValue(staticPayload.password)) {
      user.password = staticPayload.password;
      user.plainPassword = staticPayload.plain_password || staticPayload.password;
    }

    const roleId = this.coerceRelationId(staticPayload.role_id);
    if (roleId !== null && roleId !== user.role?.id) {
      const newRole = await roleRepo.findOne({ where: { id: roleId } });
      if (!newRole) throw new BadRequestException(`Role with ID ${roleId} not found.`);
      user.role = newRole;
    }
  }

  override async findAll(req: any, relations: string[] = []): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const data = await repo.find({ where: { isSystem: Not(true) } as any, relations });
      const context = await this.getUsersSchemaContext(req);
      const dynamicRows = await this.loadUserDynamicRows(req, context.moduleId, data.map((user) => user.id));

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data: data.map((user) =>
          this.buildUserResponse(user, dynamicRows.get(user.id) || {}, {
            systemFieldKeys: context.systemFieldKeys,
            aliasToCanonicalMap: context.aliasToCanonicalMap,
          }),
        ),
      };
    } catch {
      throw new InternalServerErrorException('Failed to retrieve users');
    }
  }

  override async paginate(
    req: any,
    page = 1,
    relations: string[] = [],
    limit?: number,
  ): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const parsedLimit = limit !== undefined ? Number(limit) : undefined;
      const currentPage = Math.max(Number(page) || 1, 1);
      const queryOptions: any = {
        where: { isSystem: Not(true) } as any,
        relations,
        order: { id: 'DESC' } as any,
      };

      if (parsedLimit && parsedLimit > 0) {
        queryOptions.take = Math.min(Math.max(parsedLimit, 1), 100);
        queryOptions.skip = (currentPage - 1) * queryOptions.take;
      }

      const [data, total] = await repo.findAndCount(queryOptions);
      const context = await this.getUsersSchemaContext(req);
      const dynamicRows = await this.loadUserDynamicRows(req, context.moduleId, data.map((user) => user.id));

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        meta: {
          total,
          page: currentPage,
          lastPage: queryOptions.take ? Math.ceil(total / queryOptions.take) || 1 : 1,
        },
        data: data.map((user) =>
          this.buildUserResponse(user, dynamicRows.get(user.id) || {}, {
            systemFieldKeys: context.systemFieldKeys,
            aliasToCanonicalMap: context.aliasToCanonicalMap,
          }),
        ),
      };
    } catch {
      throw new InternalServerErrorException('Failed to paginate users');
    }
  }

  override async findOne(req: any, id: number, relations: string[] = []): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const entity = await repo.findOne({
        where: { id, isSystem: Not(true) } as any,
        relations,
      });
      if (!entity) throw new NotFoundException(`User with ID ${id} not found`);

      const context = await this.getUsersSchemaContext(req);
      const dynamicRows = await this.loadUserDynamicRows(req, context.moduleId, [entity.id]);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        data: this.buildUserResponse(entity, dynamicRows.get(entity.id) || {}, {
          systemFieldKeys: context.systemFieldKeys,
          aliasToCanonicalMap: context.aliasToCanonicalMap,
        }),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve user');
    }
  }

  async create(req: any, dto: Record<string, any>): Promise<any> {
    try {
      const context = await this.getUsersSchemaContext(req);
      const userRepo: Repository<User> = this.getRepo(req);

      const normalizedDto = this.resolvePayloadAliases(dto, context.aliasToCanonicalMap);
      this.assertCreatePayloadRequiredFields(normalizedDto, context.requiredFieldKeys, context.fieldLabels);
      let { staticPayload, dynamicPayload } = this.splitUserPayload(normalizedDto, context.systemFieldKeys);
      ({ staticPayload, dynamicPayload } = this.promoteDynamicSystemFields(
        staticPayload,
        dynamicPayload,
        context.aliasToCanonicalMap,
        context.systemFieldKeys,
      ));

      if (staticPayload.email) {
        const existing = await userRepo.findOne({ where: { email: staticPayload.email } });
        if (existing) throw new BadRequestException('A user with this email already exists.');
      }

      const user = userRepo.create({});
      await this.applyStaticPayloadToUser(req, user as User, staticPayload, { isCreate: true });

      const saved = await userRepo.save(user);

      await this.upsertUserDynamicRow(
        req,
        context.moduleId,
        saved.id,
        context.activeVersionId,
        dynamicPayload,
        this.getActorId(req),
      );

      const payload = await userRepo.findOne({
        where: { id: saved.id },
        relations: ['role'],
      });

      const dynamicData = context.moduleId
        ? (await req.tenantConnection.getRepository(EntityDynamicData).findOne({
            where: { moduleId: context.moduleId, entityId: saved.id },
          }))?.data || {}
        : {};

      /*
      const mailPayload = {
        module: 'users',
        action: 'create',
        tenantId: req?.tenantId || null,
        to: payload?.email || undefined,
        data: {
          user_id: payload?.id,
          name: payload?.name,
          first_name: payload?.name?.split(' ')?.[0] || payload?.name,
          full_name: payload?.name,
          email: payload?.email,
          username: payload?.username,
          password: staticPayload.password,
          user_password: staticPayload.password,
          tenant_slug: req?.tenantId || null,
          tenant_login_url: this.getTenantLoginUrl(),
          logo_url: `${this.getFrontendBaseUrl()}/assets/eusocial-logo.png`,
          role_name: payload?.role?.name || null,

        },
      };

      const isDevelopment = (process.env.NODE_ENV || 'development').toLowerCase() === 'development';
      let emailNotification: any;
      if (isDevelopment) {
        try {
          const mailResult = await this.mailService.sendTemplateMail(req, mailPayload);
          emailNotification = {
            attempted: true,
            success: true,
            status: mailResult.status,
            logId: mailResult.logId,
            idempotencyKey: mailResult.idempotencyKey,
          };
        } catch (mailError) {
          const mailErrorMessage = mailError instanceof Error ? mailError.message : 'Unknown email dispatch error';
          console.error('Tenant user email trigger failed:', mailErrorMessage);
          emailNotification = {
            attempted: true,
            success: false,
            error: mailErrorMessage,
          };
        }
      } else {
        void this.mailService.sendTemplateMail(req, mailPayload).catch((mailError) => {
          console.error('Tenant user email trigger failed:', mailError);
        });
      }
      */

      return {
        success: true,
        message: 'Tenant user created successfully',
        tenant: req.tenantConnection.options.database,
        data: this.buildUserResponse(payload as User, dynamicData, {
          systemFieldKeys: context.systemFieldKeys,
          aliasToCanonicalMap: context.aliasToCanonicalMap,
        }),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Tenant user creation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Failed to create tenant user: ${errorMessage}`);
    }
  }

  async update(req: any, id: number, dto: Record<string, any>): Promise<any> {
    try {
      const context = await this.getUsersSchemaContext(req);
      const userRepo: Repository<User> = this.getRepo(req);
      const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);

      const user = await userRepo.findOne({
        where: { id },
        relations: ['role'],
      });
      if (!user) throw new NotFoundException(`User with ID ${id} not found.`);
      if (user.isSystem) throw new BadRequestException('System users cannot be modified.');

      const normalizedDto = this.resolvePayloadAliases(dto, context.aliasToCanonicalMap);
      let { staticPayload, dynamicPayload } = this.splitUserPayload(normalizedDto, context.systemFieldKeys);
      ({ staticPayload, dynamicPayload } = this.promoteDynamicSystemFields(
        staticPayload,
        dynamicPayload,
        context.aliasToCanonicalMap,
        context.systemFieldKeys,
      ));
      const existingDynamic = context.moduleId
        ? await dynamicRepo.findOne({ where: { moduleId: context.moduleId, entityId: user.id } })
        : null;
      const mergedDynamic = {
        ...(existingDynamic?.data || {}),
        ...dynamicPayload,
      };
      this.assertCreatePayloadRequiredFields(
        this.buildRequiredValidationPayload(user, staticPayload, mergedDynamic),
        context.requiredFieldKeys,
        context.fieldLabels,
      );

      await this.applyStaticPayloadToUser(req, user, staticPayload);

      const updated = await userRepo.save(user);
      await this.upsertUserDynamicRow(
        req,
        context.moduleId,
        updated.id,
        context.activeVersionId,
        mergedDynamic,
        this.getActorId(req),
      );

      const payload = await userRepo.findOne({
        where: { id: updated.id },
        relations: ['role'],
      });

      const dynamicData = context.moduleId
        ? (await dynamicRepo.findOne({ where: { moduleId: context.moduleId, entityId: updated.id } }))?.data || {}
        : {};

      /*
      void this.mailService
        .sendTemplateMail(req, {
          module: 'users',
          action: 'update',
          tenantId: req?.tenantId || null,
          to: payload?.email || undefined,
          data: {
            user_id: payload?.id,
            name: payload?.name,
            first_name: payload?.name?.split(' ')?.[0] || payload?.name,
            full_name: payload?.name,
            email: payload?.email,
            username: payload?.username,
            password: staticPayload.password || 'Not changed',
            user_password: staticPayload.password || 'Not changed',
            tenant_slug: req?.tenantId || null,
            tenant_login_url: this.getTenantLoginUrl(),
            logo_url: `${this.getFrontendBaseUrl()}/assets/eusocial-logo.png`,
            role_name: payload?.role?.name || null,

          },
        })
        .catch((mailError) => {
          console.error('Tenant user update email trigger failed:', mailError);
        });
      */

      return {
        success: true,
        message: 'Tenant user updated successfully',
        tenant: req.tenantConnection.options.database,
        data: this.buildUserResponse(payload as User, dynamicData, {
          systemFieldKeys: context.systemFieldKeys,
          aliasToCanonicalMap: context.aliasToCanonicalMap,
        }),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Tenant user update failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Failed to update tenant user: ${errorMessage}`);
    }
  }

  private resolveCheckboxOptionIndex(
    options: Array<{ label?: string; value?: string }>,
    filterValue: string,
  ): number | null {
    const normalizedFilter = this.normalizeFieldAlias(filterValue);

    if (/^\d+$/.test(filterValue)) {
      return Number(filterValue);
    }

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
    fieldDefinition?: { fieldType: string; options: Array<{ label: string; value: string }> },
  ): void {
    const fieldType = fieldDefinition?.fieldType?.toLowerCase() ?? '';
    const truthySql = `('true', '1', 'yes')`;

    // if (fieldType === 'checkbox') {
    //   const selectedOptions = value
    //     .split(',')
    //     .map((option) => option.trim())
    //     .filter(Boolean);

    //   selectedOptions.forEach((optionValue, optionIdx) => {
    //     const paramSuffix = `${idx}_${optionIdx}`;
    //     const optionIndex = this.resolveCheckboxOptionIndex(fieldDefinition?.options ?? [], optionValue);

    //     if (optionIndex !== null) {
    //       dynamicQb.andWhere(
    //         `(
    //           LOWER(COALESCE(jsonb_extract_path_text(dynamic.data, :pathKey${paramSuffix}, :pathIndex${paramSuffix}), '')) IN ${truthySql}
    //           OR LOWER(COALESCE(jsonb_extract_path_text(dynamic.data, :pathKey${paramSuffix}, :pathOption${paramSuffix}), '')) IN ${truthySql}
    //         )`,
    //         {
    //           [`pathKey${paramSuffix}`]: key,
    //           [`pathIndex${paramSuffix}`]: String(optionIndex),
    //           [`pathOption${paramSuffix}`]: optionValue,
    //         },
    //       );
    //       return;
    //     }

    //     dynamicQb.andWhere(
    //       `LOWER(COALESCE(jsonb_extract_path_text(dynamic.data, :pathKey${paramSuffix}, :pathOption${paramSuffix}), '')) IN ${truthySql}`,
    //       {
    //         [`pathKey${paramSuffix}`]: key,
    //         [`pathOption${paramSuffix}`]: optionValue,
    //       },
    //     );
    //   });
    //   return;
    // }

    if (fieldType === 'checkbox') {
      const selectedOptions = value
        .split(',')
        .map((option) => option.trim())
        .filter(Boolean);

      selectedOptions.forEach((optionValue, optionIdx) => {
        const paramSuffix = `${idx}_${optionIdx}`;

        dynamicQb.andWhere(
          `dynamic.data->:key::text @> :value::jsonb`,
          {
            key,
            value: JSON.stringify([optionValue]),
          },
        );
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

  async search(
    req: any,
    limit = 15,
    filters?: {
      name?: string;
      email?: string;
      roleId?: number;
      dynamicFilters?: Record<string, any>;
    },
  ): Promise<any> {
    try {
      const userRepo: Repository<User> = this.getRepo(req);
      const parsedLimit = Number(limit);
      const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
      const name = filters?.name?.trim();
      const email = filters?.email?.trim();
      const roleId = filters?.roleId;
      const dynamicFilters = Object.entries(filters?.dynamicFilters || {}).reduce(
        (acc, [key, value]) => {
          const normalizedKey = String(key || '').trim();
          if (!normalizedKey) return acc;

          const normalizedValue =
            typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value);

          if (!normalizedValue) return acc;

          acc[normalizedKey] = normalizedValue;
          return acc;
        },
        {} as Record<string, string>,
      );
      const hasFilters = Boolean(
        name ||
          email ||
          roleId ||
          Object.keys(dynamicFilters).length,
      );

      if (!hasFilters) {
        return {
          success: true,
          tenant: req.tenantConnection.options.database,
          count: 0,
          data: [],
        };
      }

      const qb = userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .where('user.isSystem = :isSystem', { isSystem: false });

      if (name) qb.andWhere('user.name ILIKE :name', { name: `%${name}%` });
      if (email) qb.andWhere('user.email ILIKE :email', { email: `%${email}%` });
      if (roleId) qb.andWhere('role.id = :roleId', { roleId });

      const context = await this.getUsersSchemaContext(req);
      if (Object.keys(dynamicFilters).length) {
        if (!context.moduleId) {
          return {
            success: true,
            tenant: req.tenantConnection.options.database,
            count: 0,
            data: [],
          };
        }

        const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
        const dynamicQb = dynamicRepo
          .createQueryBuilder('dynamic')
          .select('dynamic.entityId', 'entityId')
          .where('dynamic.moduleId = :moduleId', { moduleId: context.moduleId });

        let idx = 0;
        for (const [key, value] of Object.entries(dynamicFilters)) {
          if (!/^[a-zA-Z0-9_\-]+$/.test(key)) {
            continue;
          }

          const canonicalKey = context.aliasToCanonicalMap.get(key) || key;
          const fieldDefinition =
            context.fieldDefinitions.get(key) || context.fieldDefinitions.get(canonicalKey);

          this.applyDynamicFieldFilter(dynamicQb, idx, key, value, fieldDefinition);
          idx += 1;
        }

        const matched = await dynamicQb.getRawMany<{ entityId: string }>();
        const matchedIds = matched
          .map((row) => Number(row.entityId))
          .filter((id) => Number.isFinite(id));

        if (!matchedIds.length) {
          return {
            success: true,
            tenant: req.tenantConnection.options.database,
            count: 0,
            data: [],
          };
        }

        qb.andWhere('user.id IN (:...dynamicIds)', { dynamicIds: matchedIds });
      }

      qb.orderBy('user.id', 'DESC').take(take);

      const users = await qb.getMany();
      const dynamicRows = await this.loadUserDynamicRows(req, context.moduleId, users.map((user) => user.id));

      const data = users.map((user) =>
        this.buildUserResponse(user, dynamicRows.get(user.id) || {}, {
          systemFieldKeys: context.systemFieldKeys,
          aliasToCanonicalMap: context.aliasToCanonicalMap,
        }),
      );

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data,
      };
    } catch (error) {
      console.error('Tenant user search failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Failed to search tenant users: ${errorMessage}`);
    }
  }

  async sendCredentials(req: any, id: number, dto: SendUserCredentialsDto): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const user = await repo.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      const recipientEmail = dto.recipient_email || user.email || undefined;
      const payload = {
        module: 'users',
        action: 'credentials',
        tenantId: req?.tenantId || null,
        to: recipientEmail,
        data: {
          name: user.name,
          email: user.email,
          password: dto.password || user.plainPassword || user.password,
          tenant_login_url: this.getTenantLoginUrl(),
          logo_url: `${this.getFrontendBaseUrl()}/assets/eusocial-logo.png`,
        },
      };

      const isDevelopment = (process.env.NODE_ENV || 'development').toLowerCase() === 'development';
      if (isDevelopment) {
        const result = await this.mailService.sendTemplateMail(req, payload);
        return {
          success: true,
          message: 'Credentials email sent successfully',
          data: result,
        };
      }

      void this.mailService.sendTemplateMail(req, payload).catch((error) => {
        console.error('Failed to send credentials email:', error);
      });

      return {
        success: true,
        message: 'Credentials email queued successfully',
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to send credentials email');
    }
  }

  async delete(req: any, id: number): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const user = await repo.findOne({ where: { id } });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      if (user.isSystem) {
        throw new BadRequestException('System users cannot be deleted.');
      }

      await repo.remove(user);

      const context = await this.getUsersSchemaContext(req);
      if (context.moduleId) {
        const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);
        await dynamicRepo.delete({ moduleId: context.moduleId, entityId: id });
      }

      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete user');
    }
  }
}
