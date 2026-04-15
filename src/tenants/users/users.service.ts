import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, ILike, Repository } from 'typeorm';
import { User } from './entities';
import { TenantAbstractService } from '../../common/abstract';
import { Role } from '../role/entities';
import { CreateUserDto, UpdateUserDto } from './dto';
import { JobPosition } from '../job-positions/entities';
import { Location } from '../locations/entities';

@Injectable()
export class UsersService extends TenantAbstractService<User> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(User));
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

      return {
        success: true,
        message: 'Tenant user created successfully',
        tenant: req.tenantConnection.options.database,
        data: payload,
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
          { name: ILike(`%${keyword}%`) },
          // { email: ILike(`%${keyword}%`) },
          { username: ILike(`%${keyword}%`) },
          // { phoneNumber: ILike(`%${keyword}%`) },
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
}
