import {Controller, Get} from '@nestjs/common';
import {PermissionService} from './permission.service';
import {MasterAccess} from '../../common/decorators';

@Controller('master/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {
  }

  @Get()
  @MasterAccess('view-users')
  async all() {
    return this.permissionService.all();
  }
}
