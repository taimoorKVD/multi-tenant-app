import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { MasterAbstractService, ApiResponse } from '../../common/abstract';
import { Role } from './entities';
import { Permission } from '../permission/entities';

@Injectable()
export class RoleService extends MasterAbstractService<Role> {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permRepo: Repository<Permission>,
  ) {
    super(roleRepo);
  }

  // ✅ Signature matches base class (DeepPartial<Role>)
  async create(data: DeepPartial<Role>): Promise<ApiResponse<Role>> {
    try {
      const { name, permissions } = data as any;

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

  // ✅ Signature matches base class (DeepPartial<Role>)
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
}
