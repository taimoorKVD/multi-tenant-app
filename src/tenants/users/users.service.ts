import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, ILike, Not, Repository } from 'typeorm';
import { User } from './entities';
import { TenantAbstractService } from '../../common/abstract';
import { Role } from '../role/entities';
import { CreateUserDto, UpdateUserDto } from './dto';
import { JobPosition } from '../job-positions/entities';
import { Location } from '../locations/entities';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class UsersService extends TenantAbstractService<User> {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {
    super(dataSource.getRepository(User));
  }

  private getFrontendBaseUrl(): string {
    const frontendUrl = process.env.FRONTEND_URL?.trim() || process.env.APP_FRONTEND_URL?.trim();
    if (frontendUrl) {
      return frontendUrl.replace(/\/+$/, '');
    }

    return 'http://localhost:4200';
  }

  private getTenantLoginUrl(): string {
    const frontendBaseUrl = this.getFrontendBaseUrl();
    return `${frontendBaseUrl}/tenant/login`;
  }

  override async findAll(req: any, relations: string[] = []): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const data = await repo.find({ where: { isSystem: Not(true) } as any, relations });
      const sanitized = this.sanitizeCollection(data as any[]);
      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: sanitized.length,
        data: sanitized,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve users');
    }
  }

  override async paginate(req: any, page = 1, relations: string[] = []): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const take = this.paginateLimit;
      const [data, total] = await repo.findAndCount({
        where: { isSystem: Not(true) } as any,
        take,
        skip: (page - 1) * take,
        relations,
        order: { id: 'DESC' } as any,
      });
      const sanitized = this.sanitizeCollection(data as any[]);
      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        meta: { total, page, lastPage: Math.ceil(total / take) },
        data: sanitized,
      };
    } catch (error) {
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
      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        data: this.sanitizeEntity(entity),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve user');
    }
  }

  async create(req: any, dto: CreateUserDto): Promise<any> {
    try {
      const userRepo: Repository<User> = this.getRepo(req);
      const roleRepo: Repository<Role> = req.tenantConnection.getRepository(Role);
      const jobPositionRepo: Repository<JobPosition> =
        req.tenantConnection.getRepository(JobPosition);
      const locationRepo: Repository<Location> = req.tenantConnection.getRepository(Location);

      const {
        name,
        email,
        phone_number,
        address,
        username,
        password,
        role_id,
        job_position_id,
        location_id,
        availability_days,
      } = dto;

      const existing = await userRepo.findOne({ where: { email } });
      if (existing) throw new BadRequestException('A user with this email already exists.');

      let role: Role | null = null;
      if (role_id) {
        role = await roleRepo.findOne({ where: { id: role_id } });
        if (!role) throw new BadRequestException(`Role with ID ${role_id} not found.`);
      }

      let jobPosition: JobPosition | null = null;
      if (job_position_id) {
        jobPosition = await jobPositionRepo.findOne({ where: { id: job_position_id } });
        if (!jobPosition) {
          throw new BadRequestException(`Job position with ID ${job_position_id} not found.`);
        }
      }

      let location: Location | null = null;
      if (location_id) {
        location = await locationRepo.findOne({ where: { id: location_id } });
        if (!location) {
          throw new BadRequestException(`Location with ID ${location_id} not found.`);
        }
      }

      const user = userRepo.create({
        name,
        email,
        phoneNumber: phone_number || null,
        address: address || null,
        username: username || null,
        password,
        availabilityDays: availability_days?.length ? availability_days : null,
        ...(role ? { role } : {}),
        ...(jobPosition ? { jobPosition } : {}),
        ...(location ? { location } : {}),
      });

      const saved = await userRepo.save(user);
      const payload = await userRepo.findOne({
        where: { id: saved.id },
        relations: ['role', 'jobPosition', 'location'],
      });
      delete (payload as any)?.password;
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
          password,
          user_password: password,
          tenant_slug: req?.tenantId || null,
          tenant_login_url: this.getTenantLoginUrl(),
          logo_url: `${this.getFrontendBaseUrl()}/assets/eusocial-logo.png`,
          role_name: payload?.role?.name || null,
          job_position_name: payload?.jobPosition?.name || null,
          location_name: payload?.location?.name || null,
        },
      };

      const isDevelopment =
        (process.env.NODE_ENV || 'development').toLowerCase() === 'development';
      let emailNotification:
        | {
            attempted: true;
            success: boolean;
            status?: 'sent' | 'queued';
            logId?: number;
            idempotencyKey?: string;
            error?: string;
          }
        | undefined;

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
          const mailErrorMessage =
            mailError instanceof Error ? mailError.message : 'Unknown email dispatch error';
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
        data: payload,
        ...(isDevelopment ? { email_notification: emailNotification } : {}),
      };
    } catch (error) {
      console.error('Tenant user creation failed:', error);
      throw new InternalServerErrorException(`Failed to create tenant user: ${error.message}`);
    }
  }

  async update(req: any, id: number, dto: UpdateUserDto): Promise<any> {
    try {
      const userRepo: Repository<User> = this.getRepo(req);
      const roleRepo: Repository<Role> = req.tenantConnection.getRepository(Role);
      const jobPositionRepo: Repository<JobPosition> =
        req.tenantConnection.getRepository(JobPosition);
      const locationRepo: Repository<Location> = req.tenantConnection.getRepository(Location);

      const user = await userRepo.findOne({
        where: { id },
        relations: ['role', 'jobPosition', 'location'],
      });
      if (!user) throw new NotFoundException(`User with ID ${id} not found.`);
      if (user.isSystem) throw new BadRequestException('System users cannot be modified.');

      if (dto.email && dto.email !== user.email) {
        const existing = await userRepo.findOne({
          where: { email: dto.email },
        });
        if (existing) throw new BadRequestException('Email already in use by another user.');
        user.email = dto.email;
      }

      if (dto.name) user.name = dto.name;
      if (typeof dto.phone_number === 'string') user.phoneNumber = dto.phone_number;
      if (typeof dto.address === 'string') user.address = dto.address;
      if (typeof dto.username === 'string') user.username = dto.username;
      if (dto.password) user.password = dto.password;
      if (dto.availability_days) user.availabilityDays = dto.availability_days;

      if (dto.role_id && dto.role_id !== user.role?.id) {
        const newRole = await roleRepo.findOne({ where: { id: dto.role_id } });
        if (!newRole) throw new BadRequestException(`Role with ID ${dto.role_id} not found.`);
        user.role = newRole;
      }

      if (dto.job_position_id && dto.job_position_id !== user.jobPosition?.id) {
        const newJobPosition = await jobPositionRepo.findOne({
          where: { id: dto.job_position_id },
        });
        if (!newJobPosition) {
          throw new BadRequestException(`Job position with ID ${dto.job_position_id} not found.`);
        }
        user.jobPosition = newJobPosition;
      }

      if (dto.location_id && dto.location_id !== user.location?.id) {
        const newLocation = await locationRepo.findOne({ where: { id: dto.location_id } });
        if (!newLocation) {
          throw new BadRequestException(`Location with ID ${dto.location_id} not found.`);
        }
        user.location = newLocation;
      }

      const updated = await userRepo.save(user);
      const payload = await userRepo.findOne({
        where: { id: updated.id },
        relations: ['role', 'jobPosition', 'location'],
      });
      delete (payload as any)?.password;

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
            password: dto.password || 'Not changed',
            user_password: dto.password || 'Not changed',
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
        data: payload,
      };
    } catch (error) {
      console.error('Tenant user update failed:', error);
      throw new InternalServerErrorException(`Failed to update tenant user: ${error.message}`);
    }
  }

  async search(req: any, query: string, limit = 15): Promise<any> {
    try {
      const userRepo: Repository<User> = this.getRepo(req);
      const keyword = (query || '').trim();
      const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);

      if (!keyword) {
        return {
          success: true,
          tenant: req.tenantConnection.options.database,
          count: 0,
          data: [],
        };
      }

      const users = await userRepo.find({
        where: [
          { name: ILike(`%${keyword}%`), isSystem: Not(true) },
          // { email: ILike(`%${keyword}%`), isSystem: Not(true) },
          { username: ILike(`%${keyword}%`), isSystem: Not(true) },
          // { phoneNumber: ILike(`%${keyword}%`), isSystem: Not(true) },
        ],
        relations: ['role', 'jobPosition', 'location'],
        order: { name: 'ASC' },
        take,
      });

      const data = users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        phone_number: user.phoneNumber,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
            }
          : null,
        job_position: user.jobPosition
          ? {
              id: user.jobPosition.id,
              name: user.jobPosition.name,
            }
          : null,
        location: user.location
          ? {
              id: user.location.id,
              name: user.location.name,
            }
          : null,
      }));

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data,
      };
    } catch (error) {
      console.error('Tenant user search failed:', error);
      throw new InternalServerErrorException(`Failed to search tenant users: ${error.message}`);
    }
  }

  override async delete(req: any, id: number): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const entity = await repo.findOneBy({ id } as any);
      if (!entity) throw new NotFoundException(`User with ID ${id} not found`);
      if ((entity as any).isSystem) throw new BadRequestException('System users cannot be deleted.');

      await repo.delete(id);
      return {
        success: true,
        message: 'User deleted successfully',
        tenant: req.tenantConnection.options.database,
        deletedId: id,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to delete user');
    }
  }
}
