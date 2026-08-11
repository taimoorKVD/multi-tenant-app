import {Body, Controller, Delete, Get, Param, Post, Put, Query, Req} from '@nestjs/common';
import {UsersService} from './users.service';
import {TenantAccess} from '../../common/decorators/tenant-access.decorator';
import {CreateUserDto, SendUserCredentialsDto, UpdateTenantProfileDto, UpdateUserDto} from './dto';
import {BulkDeleteDto} from '../../common/dto';
import {BulkDeleteSwagger} from '../../common/swagger';
import {ApiTags} from '@nestjs/swagger';
import {TenantUsersSwagger} from './swagger';

@ApiTags('User Management')
@TenantUsersSwagger.Auth()
@Controller(['users', 'tenant/:tenantId/users'])
export class UsersController {
  constructor(private readonly usersService: UsersService) {
  }

  @TenantAccess()
  @Get('profile')
  @TenantUsersSwagger.GetProfile()
  getProfile(@Req() req) {
    return this.usersService.getOwnProfile(req);
  }

  @TenantAccess()
  @Put('profile')
  @TenantUsersSwagger.UpdateProfile()
  updateProfile(@Req() req, @Body() dto: UpdateTenantProfileDto) {
    return this.usersService.updateOwnProfile(req, dto);
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
      ['role', 'jobPosition'],
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @TenantAccess('view-user')
  @Get('search')
  @TenantUsersSwagger.Search()
  search(@Req() req, @Query() query: Record<string, any>) {
    const name = typeof query?.name === 'string' ? query.name : undefined;
    const email = typeof query?.email === 'string' ? query.email : undefined;
    const roleId = this.parseOptionalQueryId(query?.role_id ?? query?.role);
    const limit = query?.limit !== undefined ? Number(query.limit) : undefined;

    const reservedKeys = new Set([
      'name',
      'email',
      'role_id',
      'role',
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
      roleId,
      dynamicFilters,
    });
  }

  private parseOptionalQueryId(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const id = Number(value);
    return Number.isFinite(id) ? id : undefined;
  }

  @TenantAccess('view-user')
  @Get(':id')
  @TenantUsersSwagger.FindOne()
  findOne(@Req() req, @Param('id') id: number) {
    return this.usersService.findOne(req, id, ['role', 'jobPosition']);
  }

  @TenantAccess('edit-user')
  @Put(':id')
  @TenantUsersSwagger.Update()
  update(@Req() req, @Param('id') id: number, @Body() body: any) {
    return this.usersService.update(req, id, body);
  }

  @TenantAccess('delete-user')
  @Delete('bulk')
  @BulkDeleteSwagger('users')
  bulkRemove(@Req() req, @Body() dto: BulkDeleteDto) {
    return this.usersService.bulkDelete(req, dto.ids);
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
