import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DeepPartial, In, Repository} from 'typeorm';
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

  async bulkDelete(ids: number[]): Promise<ApiResponse<{ deletedIds: number[]; count: number }>> {
    try {
      const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
      if (!uniqueIds.length) {
        throw new BadRequestException('At least one valid ID is required');
      }

      const roles = await this.roleRepo.find({
        where: { id: In(uniqueIds) },
        relations: ['users'],
      });
      const foundIds = roles.map((role) => role.id);
      const missingIds = uniqueIds.filter((id) => !foundIds.includes(id));

      if (missingIds.length) {
        throw new NotFoundException(`Roles not found for IDs: ${missingIds.join(', ')}`);
      }

      const assigned = roles.filter((role) => (role.users ?? []).length > 0);
      if (assigned.length) {
        throw new BadRequestException(
          `Role(s) cannot be deleted because they are assigned to users: ${assigned
            .map((role) => `${role.name} (id=${role.id})`)
            .join(', ')}`,
        );
      }

      await this.roleRepo.delete(foundIds);

      return {
        success: true,
        message: `${foundIds.length} role(s) deleted successfully`,
        data: { deletedIds: foundIds, count: foundIds.length },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to bulk delete roles.');
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
      const parsedLimit = Number(limit);
      const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
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
