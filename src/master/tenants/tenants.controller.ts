import {Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query} from '@nestjs/common';
import {TenantsService} from './tenants.service';
import {Tenant} from './entities';
import {CreateTenantDto, SendTenantCredentialsDto} from './dto';
import {MasterAccess} from '../../common/decorators';
import {ApiTags} from "@nestjs/swagger";
import {TenantSwagger} from "./swagger";

@ApiTags('Tenant Management')
@TenantSwagger.Auth()
@Controller('master/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {
  }

  @Get()
  @MasterAccess('view-tenant')
  @TenantSwagger.FindAll()
  async findAll(@Query('page') page: number = 1, @Query('limit') limit?: number) {
    return this.tenantsService.paginate(page, limit !== undefined ? Number(limit) : undefined);
  }

  @Post()
  @MasterAccess('create-tenant')
  @TenantSwagger.Create()
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Post(':id/send-credentials')
  @MasterAccess('create-tenant')
  @TenantSwagger.SendCredentials()
  async sendCredentials(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendTenantCredentialsDto,
  ) {
    return this.tenantsService.sendCredentials(id, dto.email);
  }

  // Get single user by numeric ID
  @Get(':id')
  @MasterAccess('view-tenant')
  @TenantSwagger.FindOne()
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tenantsService.findOne(id);
  }

  @Delete(':id')
  @MasterAccess('delete-tenant')
  @TenantSwagger.Delete()
  async remove(@Param('id') id: number) {
    return this.tenantsService.remove(id);
  }

  @Put(':id')
  @MasterAccess('edit-tenant')
  @TenantSwagger.Update()
  async update(@Param('id') id: number, @Body() body: Partial<Tenant>) {
    return this.tenantsService.update(id, body);
  }
}
