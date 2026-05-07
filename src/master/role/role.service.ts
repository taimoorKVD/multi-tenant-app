import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DeepPartial, Repository} from 'typeorm';
import {ApiResponse, MasterAbstractService} from '../../common/abstract';
import {Role} from './entities';
import {Permission} from '../permission/entities';
import {User} from "../users/entities";

@Injectable()
export class RoleService extends MasterAbstractService<Role> {
  constructor(
      @InjectRepository(Role)
      private readonly roleRepo: Repository<Role>,
      @InjectRepository(Permission)
      private readonly permRepo: Repository<Permission>,
      @InjectRepository(User)
      private readonly userRepo: Repository<User>,
  ) {
    super(roleRepo);
  }

  private async ensureRoleNotAssigned(id: number) {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['users'],
    });

    if ((role?.users ?? []).length > 0) {
      throw new BadRequestException(
          `Role cannot be deleted because it is assigned to ${(role?.users ?? []).length} user(s).`,
      );
    }

    return true;
  }

  async delete(id: number): Promise<ApiResponse<null>> {
    try {
      const role = await this.roleRepo.findOne({where: {id}});
      if (!role) {
        throw new NotFoundException('Role not found.');
      }

      await this.ensureRoleNotAssigned(id);

      await this.roleRepo.delete(id);

      return {
        success: true,
        message: 'Role deleted successfully.',
        data: null,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to delete role.');
    }
  }

  async create(data: DeepPartial<Role>): Promise<ApiResponse<Role>> {
    try {
      const {name, permissions} = data as any;

      // Fetch valid permission entities
      const validPermissions = permissions?.length
          ? await this.permRepo.findByIds(permissions)
          : [];

      if (!validPermissions.length) {
        throw new BadRequestException('At least one valid permission must be selected.');
      }

      const role = this.roleRepo.create({
        name,
        permissions: validPermissions,
      });

      const saved = await this.roleRepo.save(role);

      return {
        success: true,
        message: 'Role created successfully',
        data: saved,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to create record: ${error.message}`);
    }
  }

  async update(id: number, data: DeepPartial<Role>): Promise<ApiResponse<Role>> {
    try {
      const role = await this.roleRepo.findOne({
        where: { id },
        relations: ['permissions'],
      });

      if (!role) throw new NotFoundException('Role not found.');

      const { name, permissions } = data as any;

      if (name) role.name = name;

      if (permissions?.length) {
        const validPermissions = await this.permRepo.findByIds(permissions);
        if (!validPermissions.length) {
          throw new BadRequestException('Invalid permissions provided.');
        }
        role.permissions = validPermissions;
      }

      const saved = await this.roleRepo.save(role);

      return {
        success: true,
        message: 'Role updated successfully',
        data: saved,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to update role: ${error.message}`);
    }
  }

  async search(
    limit = 15,
    filters?: {
      name?: string;
      permissionId?: number;
    },
  ) {
    try {
      const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);
      const name = filters?.name?.trim();
      const permissionId = filters?.permissionId;
      const hasFilters = Boolean(name || permissionId);

      if (!hasFilters) {
        return {success: true, count: 0, data: []};
      }

      const qb = this.roleRepo
        .createQueryBuilder('role')
        .leftJoinAndSelect('role.permissions', 'permission');

      if (name) {
        qb.andWhere('role.name ILIKE :name', {name: `%${name}%`});
      }

      if (permissionId) {
        qb.andWhere('permission.id = :permissionId', {permissionId});
      }

      const data = await qb.orderBy('role.id', 'DESC').take(take).getMany();
      return {success: true, count: data.length, data};
    } catch (error) {
      console.error('Master role search failed:', error);
      throw new InternalServerErrorException('Failed to search roles');
    }
  }
}
