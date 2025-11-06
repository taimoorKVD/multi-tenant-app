import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { JobPositionService } from './job-position.service';
import { MasterAccess } from '../../common/decorators';
import { CreateJobPositionDto, UpdateJobPositionDto, PushJobPositionDto } from './dto';

@Controller('master/jobpositions')
export class JobPositionController {
  constructor(private readonly jobPositionService: JobPositionService) {}

  @Get()
  @MasterAccess('view-jobposition')
  async all(@Query('page') page: number = 1) {
    return this.jobPositionService.paginate(page);
  }

  @Post()
  @MasterAccess('create-jobposition')
  async create(@Body() body: CreateJobPositionDto) {
    return this.jobPositionService.create(body);
  }

  @Get(':id')
  @MasterAccess('view-jobposition')
  async findOne(@Param('id') id: number) {
    return this.jobPositionService.findOne(id);
  }

  @Put(':id')
  @MasterAccess('edit-jobposition')
  async update(@Param('id') id: number, @Body() body: UpdateJobPositionDto) {
    return this.jobPositionService.update(id, body);
  }

  @Delete(':id')
  @MasterAccess('delete-jobposition')
  async delete(@Param('id') id: number) {
    return this.jobPositionService.delete(id);
  }

  @Post('push-to-tenants')
  @MasterAccess('view-jobposition')
  async pushToTenants(@Body() dto: PushJobPositionDto) {
    return await this.jobPositionService.pushToTenants(dto);
  }
}
