import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Not, Repository } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';
import { Role } from '../role/entities';
import { SendUserCredentialsDto } from './dto';
import { MailService } from '../../mail/mail.service';
import { User } from './entities';
import { DynamicFieldsService, DynamicSchemaContext } from '../form-builder/services';

@Injectable()
export class UsersService extends TenantAbstractService<User> {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly dynamicFields: DynamicFieldsService,
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

  private getUsersSchemaContext(req: any): Promise<DynamicSchemaContext> {
    return this.dynamicFields.getSchemaContext(req, this.usersModuleSlug, {
      fallbackSystemFieldKeys: this.fallbackSystemFieldKeys,
      relationFieldAliases: this.relationFieldAliases,
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

  private coerceRelationId(value: unknown): number | null {
    if (!this.dynamicFields.hasPresentValue(value)) {
      return null;
    }

    if (typeof value === 'object' && value !== null && 'id' in (value as Record<string, unknown>)) {
      const id = Number((value as Record<string, unknown>).id);
      return Number.isFinite(id) ? id : null;
    }

    const id = Number(value);
    return Number.isFinite(id) ? id : null;
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

  private buildUserResponse(
    user: User,
    dynamicData: Record<string, any> = {},
    context: DynamicSchemaContext,
  ): Record<string, any> {
    return this.dynamicFields.buildResponse(
      context,
      {
        name: user.name,
        email: user.email,
        password: user.plainPassword ?? null,
        plain_password: user.plainPassword ?? null,
        role_id: user.role?.id ?? null,
      },
      dynamicData,
      {
        id: user.id,
        is_system: user.isSystem,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
      },
    );
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

    const shouldApplyScalar = (value: unknown) => isCreate || this.dynamicFields.hasPresentValue(value);

    if (shouldApplyScalar(staticPayload.name) && staticPayload.name !== undefined) {
      user.name = staticPayload.name;
    }

    if (staticPayload.email !== undefined && (isCreate || this.dynamicFields.hasPresentValue(staticPayload.email))) {
      if (!isCreate && staticPayload.email !== user.email) {
        const existing = await userRepo.findOne({ where: { email: staticPayload.email } });
        if (existing && existing.id !== user.id) {
          throw new BadRequestException('Email already in use by another user.');
        }
      }
      user.email = staticPayload.email;
    }

    if (this.dynamicFields.hasPresentValue(staticPayload.password)) {
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
      const dynamicRows = await this.dynamicFields.loadDynamicRows(req, context.moduleId, data.map((user) => user.id), context);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data: data.map((user) =>
          this.buildUserResponse(user, dynamicRows.get(user.id) || {}, context),
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
      const dynamicRows = await this.dynamicFields.loadDynamicRows(req, context.moduleId, data.map((user) => user.id), context);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        meta: {
          total,
          page: currentPage,
          lastPage: queryOptions.take ? Math.ceil(total / queryOptions.take) || 1 : 1,
        },
        data: data.map((user) =>
          this.buildUserResponse(user, dynamicRows.get(user.id) || {}, context),
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
      const dynamicRows = await this.dynamicFields.loadDynamicRows(req, context.moduleId, [entity.id], context);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        data: this.buildUserResponse(entity, dynamicRows.get(entity.id) || {}, context),
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

      const normalizedDto = this.dynamicFields.resolvePayloadAliases(dto, context.aliasToCanonicalMap);
      this.assertCreatePayloadRequiredFields(normalizedDto, context.requiredFieldKeys, context.fieldLabels);
      let { staticPayload, dynamicPayload } = this.dynamicFields.splitPayload(
        normalizedDto,
        context.systemFieldKeys,
        this.ignoredPayloadKeys,
      );
      ({ staticPayload, dynamicPayload } = this.dynamicFields.promoteDynamicSystemFields(
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

      await this.dynamicFields.upsertDynamicRow(
        req,
        context.moduleId,
        saved.id,
        context.activeVersionId,
        dynamicPayload,
        this.getActorId(req),
        context,
      );

      const payload = await userRepo.findOne({
        where: { id: saved.id },
        relations: ['role'],
      });

      const dynamicData = await this.dynamicFields.loadDynamicRow(req, context.moduleId, saved.id, context);

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
        data: this.buildUserResponse(payload as User, dynamicData, context),
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

      const user = await userRepo.findOne({
        where: { id },
        relations: ['role'],
      });
      if (!user) throw new NotFoundException(`User with ID ${id} not found.`);
      if (user.isSystem) throw new BadRequestException('System users cannot be modified.');

      const normalizedDto = this.dynamicFields.resolvePayloadAliases(dto, context.aliasToCanonicalMap);
      let { staticPayload, dynamicPayload } = this.dynamicFields.splitPayload(
        normalizedDto,
        context.systemFieldKeys,
        this.ignoredPayloadKeys,
      );
      ({ staticPayload, dynamicPayload } = this.dynamicFields.promoteDynamicSystemFields(
        staticPayload,
        dynamicPayload,
        context.aliasToCanonicalMap,
        context.systemFieldKeys,
      ));
      const existingDynamic = context.moduleId
        ? await this.dynamicFields.loadDynamicRow(req, context.moduleId, user.id, context)
        : {};
      const mergedDynamic = {
        ...existingDynamic,
        ...dynamicPayload,
      };
      this.assertCreatePayloadRequiredFields(
        this.buildRequiredValidationPayload(user, staticPayload, mergedDynamic),
        context.requiredFieldKeys,
        context.fieldLabels,
      );

      await this.applyStaticPayloadToUser(req, user, staticPayload);

      const updated = await userRepo.save(user);
      await this.dynamicFields.upsertDynamicRow(
        req,
        context.moduleId,
        updated.id,
        context.activeVersionId,
        mergedDynamic,
        this.getActorId(req),
        context,
      );

      const payload = await userRepo.findOne({
        where: { id: updated.id },
        relations: ['role'],
      });

      const dynamicData = await this.dynamicFields.loadDynamicRow(req, context.moduleId, updated.id, context);

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
        data: this.buildUserResponse(payload as User, dynamicData, context),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Tenant user update failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Failed to update tenant user: ${errorMessage}`);
    }
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

      const context = await this.getUsersSchemaContext(req);

      const qb = userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .where('user.isSystem = :isSystem', { isSystem: false });

      if (name) qb.andWhere('user.name ILIKE :name', { name: `%${name}%` });
      if (email) qb.andWhere('user.email ILIKE :email', { email: `%${email}%` });
      if (roleId) qb.andWhere('role.id = :roleId', { roleId });

      // Split incoming dynamic filters (which may be keyed by field id, name,
      // label, or key) into system-field filters (applied to the users table)
      // and true dynamic filters (applied to entity_dynamic_data).
      const trueDynamicFilters: Record<string, string> = {};
      for (const [key, value] of Object.entries(dynamicFilters)) {
        const canonicalKey = this.dynamicFields.resolveCanonicalKey(context, key);

        switch (canonicalKey) {
          case 'name':
            qb.andWhere('user.name ILIKE :sysName', { sysName: `%${value}%` });
            break;
          case 'email':
            qb.andWhere('user.email ILIKE :sysEmail', { sysEmail: `%${value}%` });
            break;
          case 'role_id': {
            const parsedRoleId = Number(value);
            if (Number.isFinite(parsedRoleId)) {
              qb.andWhere('role.id = :sysRoleId', { sysRoleId: parsedRoleId });
            }
            break;
          }
          default:
            trueDynamicFilters[key] = value;
        }
      }

      if (Object.keys(trueDynamicFilters).length) {
        const matchedIds = await this.dynamicFields.findDynamicMatchedIds(req, context, trueDynamicFilters);
        if (matchedIds === null) {
          // no dynamic filters to apply
        } else if (!matchedIds.length) {
          return {
            success: true,
            tenant: req.tenantConnection.options.database,
            count: 0,
            data: [],
          };
        } else {
          qb.andWhere('user.id IN (:...dynamicIds)', { dynamicIds: matchedIds });
        }
      }

      qb.orderBy('user.id', 'DESC').take(take);

      const users = await qb.getMany();
      const dynamicRows = await this.dynamicFields.loadDynamicRows(req, context.moduleId, users.map((user) => user.id), context);

      const data = users.map((user) =>
        this.buildUserResponse(user, dynamicRows.get(user.id) || {}, context),
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
      await this.dynamicFields.deleteDynamicRow(req, context.moduleId, id);

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
