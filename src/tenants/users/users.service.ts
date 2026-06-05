import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, Not, Repository } from 'typeorm';
import { DynamicModule, Form, FormField, FormVersion } from '../form-builder/entities';
import { EntityDynamicData } from '../form-builder/entities/entity-dynamic-data.entity';
import { TenantAbstractService } from '../../common/abstract';
import { Role } from '../role/entities';
import { SendUserCredentialsDto } from './dto';
import { JobPosition } from '../job-positions/entities';
import { Location } from '../locations/entities';
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
    'phone_number',
    'address',
    'username',
    'password',
    'plain_password',
    'role_id',
    'job_position_id',
    'location_id',
    'availability_days',
    'is_system',
    'created_at',
    'updated_at',
  ]);

  private readonly ignoredPayloadKeys = new Set(['password_confirm', 'createdBy', 'updatedBy']);

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
  }> {
    const moduleRepo = req.tenantConnection.getRepository(DynamicModule);
    const formRepo = req.tenantConnection.getRepository(Form);
    const fieldRepo = req.tenantConnection.getRepository(FormField);
    const versionRepo = req.tenantConnection.getRepository(FormVersion);

    const module = await moduleRepo.findOne({ where: { slug: this.usersModuleSlug } });
    if (!module) {
      return {
        moduleId: null,
        formId: null,
        activeVersionId: null,
        systemFieldKeys: new Set(this.fallbackSystemFieldKeys),
        requiredFieldKeys: new Set(['name', 'email', 'password', 'role_id']),
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
        requiredFieldKeys: new Set(['name', 'email', 'password', 'role_id']),
      };
    }

    const [fields, activeVersion] = await Promise.all([
      fieldRepo.find({ where: { formId: form.id }, order: { sortOrder: 'ASC' } }),
      versionRepo.findOne({ where: { formId: form.id, isActive: true } }),
    ]);

    const systemFieldKeys = new Set<string>();
    const requiredFieldKeys = new Set<string>();

    for (const field of fields) {
      const key = (field.systemMappingKey || field.fieldKey || field.name || '').trim();
      if (!key) continue;

      if (field.isSystemField) {
        systemFieldKeys.add(key);
      }

      if (field.isRequired) {
        requiredFieldKeys.add(key);
      }
    }

    if (!systemFieldKeys.size) {
      this.fallbackSystemFieldKeys.forEach((key) => systemFieldKeys.add(key));
    }

    return {
      moduleId: module.id,
      formId: form.id,
      activeVersionId: activeVersion?.id ?? null,
      systemFieldKeys,
      requiredFieldKeys,
    };
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
  ): void {
    const missing = Array.from(requiredFieldKeys).filter((key) => {
      const value = payload[key];
      return value === undefined || value === null || value === '';
    });

    if (missing.length) {
      throw new BadRequestException(`Missing required form fields: ${missing.join(', ')}`);
    }

    if (payload.password_confirm !== undefined && payload.password_confirm !== payload.password) {
      throw new BadRequestException('Passwords do not match.');
    }
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

  private buildUserResponse(user: User, dynamicData: Record<string, any> = {}): Record<string, any> {
    const sanitized = this.sanitizeEntity(user) as any;
    return {
      ...dynamicData,
      ...sanitized,
      phone_number: sanitized?.phoneNumber ?? null,
      plain_password: sanitized?.plainPassword ?? null,
    };
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
        data: data.map((user) => this.buildUserResponse(user, dynamicRows.get(user.id) || {})),
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
        data: data.map((user) => this.buildUserResponse(user, dynamicRows.get(user.id) || {})),
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
        data: this.buildUserResponse(entity, dynamicRows.get(entity.id) || {}),
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
      const roleRepo: Repository<Role> = req.tenantConnection.getRepository(Role);
      const jobPositionRepo: Repository<JobPosition> = req.tenantConnection.getRepository(JobPosition);
      const locationRepo: Repository<Location> = req.tenantConnection.getRepository(Location);

      this.assertCreatePayloadRequiredFields(dto, context.requiredFieldKeys);
      const { staticPayload, dynamicPayload } = this.splitUserPayload(dto, context.systemFieldKeys);

      const existing = await userRepo.findOne({ where: { email: staticPayload.email } });
      if (existing) throw new BadRequestException('A user with this email already exists.');

      const roleId = staticPayload.role_id;
      const jobPositionId = staticPayload.job_position_id;
      const locationId = staticPayload.location_id;

      let role: Role | null = null;
      if (roleId) {
        role = await roleRepo.findOne({ where: { id: roleId } });
        if (!role) throw new BadRequestException(`Role with ID ${roleId} not found.`);
      }

      let jobPosition: JobPosition | null = null;
      if (jobPositionId) {
        jobPosition = await jobPositionRepo.findOne({ where: { id: jobPositionId } });
        if (!jobPosition) {
          throw new BadRequestException(`Job position with ID ${jobPositionId} not found.`);
        }
      }

      let location: Location | null = null;
      if (locationId) {
        location = await locationRepo.findOne({ where: { id: locationId } });
        if (!location) {
          throw new BadRequestException(`Location with ID ${locationId} not found.`);
        }
      }

      const user = userRepo.create({
        name: staticPayload.name,
        email: staticPayload.email,
        phoneNumber: staticPayload.phone_number || null,
        address: staticPayload.address || null,
        username: staticPayload.username || null,
        password: staticPayload.password,
        plainPassword: staticPayload.plain_password || staticPayload.password,
        availabilityDays: staticPayload.availability_days?.length ? staticPayload.availability_days : null,
        ...(role ? { role } : {}),
        ...(jobPosition ? { jobPosition } : {}),
        ...(location ? { location } : {}),
      });

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
        relations: ['role', 'jobPosition', 'location'],
      });

      const dynamicData = context.moduleId
        ? (await req.tenantConnection.getRepository(EntityDynamicData).findOne({
            where: { moduleId: context.moduleId, entityId: saved.id },
          }))?.data || {}
        : {};

      const mailPayload = {
        module: 'users',
        action: 'create',
        tenantId: req?.tenantId || null,
        to: payload?.email,
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
          job_position_name: payload?.jobPosition?.name || null,
          location_name: payload?.location?.name || null,
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

      return {
        success: true,
        message: 'Tenant user created successfully',
        tenant: req.tenantConnection.options.database,
        data: this.buildUserResponse(payload as User, dynamicData),
        ...(isDevelopment ? { email_notification: emailNotification } : {}),
      };
    } catch (error) {
      console.error('Tenant user creation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Failed to create tenant user: ${errorMessage}`);
    }
  }

  async update(req: any, id: number, dto: Record<string, any>): Promise<any> {
    try {
      const context = await this.getUsersSchemaContext(req);
      const userRepo: Repository<User> = this.getRepo(req);
      const roleRepo: Repository<Role> = req.tenantConnection.getRepository(Role);
      const jobPositionRepo: Repository<JobPosition> = req.tenantConnection.getRepository(JobPosition);
      const locationRepo: Repository<Location> = req.tenantConnection.getRepository(Location);
      const dynamicRepo: Repository<EntityDynamicData> = req.tenantConnection.getRepository(EntityDynamicData);

      const user = await userRepo.findOne({
        where: { id },
        relations: ['role', 'jobPosition', 'location'],
      });
      if (!user) throw new NotFoundException(`User with ID ${id} not found.`);
      if (user.isSystem) throw new BadRequestException('System users cannot be modified.');

      const { staticPayload, dynamicPayload } = this.splitUserPayload(dto, context.systemFieldKeys);
      const existingDynamic = context.moduleId
        ? await dynamicRepo.findOne({ where: { moduleId: context.moduleId, entityId: user.id } })
        : null;
      const mergedDynamic = {
        ...(existingDynamic?.data || {}),
        ...dynamicPayload,
      };

      if (staticPayload.email && staticPayload.email !== user.email) {
        const existing = await userRepo.findOne({ where: { email: staticPayload.email } });
        if (existing) throw new BadRequestException('Email already in use by another user.');
        user.email = staticPayload.email;
      }

      if (staticPayload.name !== undefined) user.name = staticPayload.name;
      if (staticPayload.phone_number !== undefined) user.phoneNumber = staticPayload.phone_number;
      if (staticPayload.address !== undefined) user.address = staticPayload.address;
      if (staticPayload.username !== undefined) user.username = staticPayload.username;
      if (staticPayload.password !== undefined) {
        user.password = staticPayload.password;
        user.plainPassword = staticPayload.plain_password || staticPayload.password;
      }
      if (staticPayload.availability_days !== undefined) user.availabilityDays = staticPayload.availability_days;

      if (staticPayload.role_id && staticPayload.role_id !== user.role?.id) {
        const newRole = await roleRepo.findOne({ where: { id: staticPayload.role_id } });
        if (!newRole) throw new BadRequestException(`Role with ID ${staticPayload.role_id} not found.`);
        user.role = newRole;
      }

      if (staticPayload.job_position_id && staticPayload.job_position_id !== user.jobPosition?.id) {
        const newJobPosition = await jobPositionRepo.findOne({ where: { id: staticPayload.job_position_id } });
        if (!newJobPosition) {
          throw new BadRequestException(`Job position with ID ${staticPayload.job_position_id} not found.`);
        }
        user.jobPosition = newJobPosition;
      }

      if (staticPayload.location_id && staticPayload.location_id !== user.location?.id) {
        const newLocation = await locationRepo.findOne({ where: { id: staticPayload.location_id } });
        if (!newLocation) throw new BadRequestException(`Location with ID ${staticPayload.location_id} not found.`);
        user.location = newLocation;
      }

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
        relations: ['role', 'jobPosition', 'location'],
      });

      const dynamicData = context.moduleId
        ? (await dynamicRepo.findOne({ where: { moduleId: context.moduleId, entityId: updated.id } }))?.data || {}
        : {};

      void this.mailService
        .sendTemplateMail(req, {
          module: 'users',
          action: 'update',
          tenantId: req?.tenantId || null,
          to: payload?.email,
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
            job_position_name: payload?.jobPosition?.name || null,
            location_name: payload?.location?.name || null,
          },
        })
        .catch((mailError) => {
          console.error('Tenant user update email trigger failed:', mailError);
        });

      return {
        success: true,
        message: 'Tenant user updated successfully',
        tenant: req.tenantConnection.options.database,
        data: this.buildUserResponse(payload as User, dynamicData),
      };
    } catch (error) {
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
      username?: string;
      phoneNumber?: string;
      roleId?: number;
      jobPositionId?: number;
      locationId?: number;
      dynamicFilters?: Record<string, any>;
    },
  ): Promise<any> {
    try {
      const userRepo: Repository<User> = this.getRepo(req);
      const parsedLimit = Number(limit);
      const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
      const name = filters?.name?.trim();
      const email = filters?.email?.trim();
      const username = filters?.username?.trim();
      const phoneNumber = filters?.phoneNumber?.trim();
      const roleId = filters?.roleId;
      const jobPositionId = filters?.jobPositionId;
      const locationId = filters?.locationId;
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
        name || email || username || phoneNumber || roleId || jobPositionId || locationId || Object.keys(dynamicFilters).length,
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
        .leftJoinAndSelect('user.jobPosition', 'jobPosition')
        .leftJoinAndSelect('user.location', 'location')
        .where('user.isSystem = :isSystem', { isSystem: false });

      if (name) qb.andWhere('user.name ILIKE :name', { name: `%${name}%` });
      if (email) qb.andWhere('user.email ILIKE :email', { email: `%${email}%` });
      if (username) qb.andWhere('user.username ILIKE :username', { username: `%${username}%` });
      if (phoneNumber) qb.andWhere('user.phone_number ILIKE :phoneNumber', { phoneNumber: `%${phoneNumber}%` });
      if (roleId) qb.andWhere('role.id = :roleId', { roleId });
      if (jobPositionId) qb.andWhere('jobPosition.id = :jobPositionId', { jobPositionId });
      if (locationId) qb.andWhere('location.id = :locationId', { locationId });

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

          dynamicQb.andWhere(
            `LOWER(COALESCE(jsonb_extract_path_text(dynamic.data, :pathKey${idx}), '')) LIKE :pathValue${idx}`,
            {
              [`pathKey${idx}`]: key,
              [`pathValue${idx}`]: `%${value.toLowerCase()}%`,
            },
          );
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

      const data = users.map((user) => this.buildUserResponse(user, dynamicRows.get(user.id) || {}));

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

      const recipientEmail = dto.recipient_email || user.email;
      const payload = {
        module: 'users',
        action: 'credentials',
        tenantId: req?.tenantId || null,
        to: recipientEmail,
        data: {
          name: user.name,
          email: user.email,
          username: user.username,
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