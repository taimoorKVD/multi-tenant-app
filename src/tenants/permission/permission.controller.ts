import {Controller, Get, InternalServerErrorException, Req,} from '@nestjs/common';
import {PermissionService} from './permission.service';

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {
  }

  /**
   * Get all permissions for a tenant
   */
  @Get()
  async all(@Req() req) {
    try {
      const result = await this.permissionService.findAll(req, ['roles']); // optional relation
      return {
        ...result,
        message: 'Permissions fetched successfully',
      };
    } catch (error) {
      console.error('❌ Failed to fetch permissions:', error);
      throw new InternalServerErrorException('Failed to fetch permissions');
    }
  }
}
