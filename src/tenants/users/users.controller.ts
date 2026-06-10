import {Body, Controller, Delete, Get, Param, Post, Put, Query, Req} from '@nestjs/common';
import {UsersService} from './users.service';
import {TenantAccess} from '../../common/decorators/tenant-access.decorator';
import {CreateUserDto, SendUserCredentialsDto, UpdateUserDto} from './dto';
import {ApiTags} from '@nestjs/swagger';
import {TenantUsersSwagger} from './swagger';

@ApiTags('User Management')
@TenantUsersSwagger.Auth()
@Controller(['users', 'tenant/:tenantId/users'])
export class UsersController {
  constructor(private readonly usersService: UsersService) {
  }

  @TenantAccess('create-user')
  @Post()
  @TenantUsersSwagger.Create()
  create(@Req() req, @Body() body: any) {
    return this.usersService.create(req, body);
  }

  @TenantAccess('view-user')
  @Get()
  @TenantUsersSwagger.FindAll()
  findAll(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
    const parsedPage = Number(page);
    const parsedLimit = limit === undefined ? undefined : Number(limit);

    return this.usersService.paginate(
      req,
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      ['role', 'jobPosition', 'location'],
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @TenantAccess('view-user')
  @Get('search')
  @TenantUsersSwagger.Search()
  search(@Req() req, @Query() query: Record<string, any>) {
    const name = typeof query?.name === 'string' ? query.name : undefined;
    const email = typeof query?.email === 'string' ? query.email : undefined;
    const username = typeof query?.username === 'string' ? query.username : undefined;
    const address = typeof query?.address === 'string' ? query.address : undefined;
    const phoneNumber = typeof query?.phone_number === 'string' ? query.phone_number : undefined;
    const roleId = query?.role_id !== undefined ? Number(query.role_id) : undefined;
    const jobPositionId =
      query?.job_position_id !== undefined ? Number(query.job_position_id) : undefined;
    const locationId = query?.location_id !== undefined ? Number(query.location_id) : undefined;
    const limit = query?.limit !== undefined ? Number(query.limit) : undefined;

    const reservedKeys = new Set([
      'name',
      'email',
      'username',
      'address',
      'phone_number',
      'role_id',
      'job_position_id',
      'location_id',
      'limit',
      'custom',
    ]);

    const dynamicFiltersFromTopLevel = Object.fromEntries(
      Object.entries(query || {}).filter(([key, value]) => {
        if (reservedKeys.has(key)) return false;
        if (value === undefined || value === null) return false;
        if (typeof value === 'string') return value.trim() !== '';
        return true;
      }),
    );

    const rawCustom = query?.custom;
    const dynamicFiltersFromCustomObject =
      rawCustom && typeof rawCustom === 'object' && !Array.isArray(rawCustom)
        ? rawCustom
        : {};

    const dynamicFilters = {
      ...dynamicFiltersFromTopLevel,
      ...dynamicFiltersFromCustomObject,
    };

    return this.usersService.search(req, Number.isFinite(limit) ? limit : undefined, {
      name,
      email,
      username,
      address,
      phoneNumber,
      roleId: Number.isFinite(roleId) ? roleId : undefined,
      jobPositionId: Number.isFinite(jobPositionId) ? jobPositionId : undefined,
      locationId: Number.isFinite(locationId) ? locationId : undefined,
      dynamicFilters,
    });
  }

  @TenantAccess('view-user')
  @Get(':id')
  @TenantUsersSwagger.FindOne()
  findOne(@Req() req, @Param('id') id: number) {
    return this.usersService.findOne(req, id, ['role', 'jobPosition', 'location']);
  }

  @TenantAccess('edit-user')
  @Put(':id')
  @TenantUsersSwagger.Update()
  update(@Req() req, @Param('id') id: number, @Body() body: any) {
    return this.usersService.update(req, id, body);
  }

  @TenantAccess('delete-user')
  @Delete(':id')
  @TenantUsersSwagger.Delete()
  remove(@Req() req, @Param('id') id: number) {
    return this.usersService.delete(req, id);
  }

  @TenantAccess('edit-user')
  @Post(':id/send-credentials')
  @TenantUsersSwagger.SendCredentials()
  sendCredentials(@Req() req, @Param('id') id: number, @Body() dto: SendUserCredentialsDto) {
    return this.usersService.sendCredentials(req, id, dto);
  }
}
