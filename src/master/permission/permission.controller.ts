import {Controller, Get, Query} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { MasterAccess } from '../../common/decorators';
import {ApiTags} from "@nestjs/swagger";
import {PermissionSwagger} from "./swagger";

@ApiTags('Permission Management')
@PermissionSwagger.Auth()
@Controller('master/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @MasterAccess('view-permission')
  @PermissionSwagger.GetAll()
  async all(@Query('page') page: number = 1, @Query('limit') limit?: number) {
    return this.permissionService.paginate(page, [], limit !== undefined ? Number(limit) : undefined);
  }

  @Get('search')
  @MasterAccess('view-permission')
  @PermissionSwagger.Search()
  async search(@Query('name') name?: string, @Query('limit') limit?: string) {
    return this.permissionService.search(limit ? Number(limit) : undefined, {name});
  }
}
