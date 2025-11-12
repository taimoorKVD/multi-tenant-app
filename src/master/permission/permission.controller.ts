import { Controller, Get } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { MasterAccess } from '../../common/decorators';
import {ApiTags} from "@nestjs/swagger";

@ApiTags('Permission Management')
@Controller('master/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @MasterAccess('view-permission')
  async all() {
    return this.permissionService.findAll();
  }
}
