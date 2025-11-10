import {Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put} from '@nestjs/common';
import {TenantsService} from './tenants.service';
import {Tenant} from './entities';
import {CreateTenantDto} from './dto';
import {MasterAccess} from '../../common/decorators';

@Controller('master/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {
  }

  @Get()
  @MasterAccess('view-tenant')
  async findAll() {
    return this.tenantsService.paginate();
  }

  @Post()
  @MasterAccess('create-tenant')
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  // ✅ Get single user by numeric ID
  @Get(':id')
  @MasterAccess('view-tenant')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tenantsService.findOne(id);
  }

  @Delete(':id')
  @MasterAccess('delete-tenant')
  async remove(@Param('id') id: number) {
    return this.tenantsService.remove(id);
  }

  @Put(':id')
  @MasterAccess('edit-tenant')
  async update(@Param('id') id: number, @Body() body: Partial<Tenant>) {
    return this.tenantsService.update(id, body);
  }
}
