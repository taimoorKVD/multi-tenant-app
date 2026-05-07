import {Body, Controller, Delete, Get, Param, Post, Put, Query} from '@nestjs/common';
import {JobPositionService} from './job-position.service';
import {MasterAccess} from '../../common/decorators';
import {CreateJobPositionDto, PushJobPositionDto, UpdateJobPositionDto} from './dto';
import {ApiTags} from "@nestjs/swagger";
import {JobPositionSwagger} from "./swagger";


@ApiTags('Job Position Management')
@JobPositionSwagger.Auth()
@Controller('master/jobpositions')
export class JobPositionController {
  constructor(private readonly jobPositionService: JobPositionService) {
  }

  @Get()
  @MasterAccess('view-jobposition')
  @JobPositionSwagger.GetAll()
  async all(@Query('page') page: number = 1, @Query('limit') limit?: number) {
    return this.jobPositionService.paginate(page, [], limit !== undefined ? Number(limit) : undefined);
  }

  @Post()
  @MasterAccess('create-jobposition')
  @JobPositionSwagger.Create()
  async create(@Body() body: CreateJobPositionDto) {
    return this.jobPositionService.create(body);
  }

  @Put(':id')
  @MasterAccess('edit-jobposition')
  @JobPositionSwagger.Update()
  async update(@Param('id') id: number, @Body() body: UpdateJobPositionDto) {
    return this.jobPositionService.update(id, body);
  }

  @Get(':id')
  @MasterAccess('view-jobposition')
  @JobPositionSwagger.FindOne()
  async findOne(@Param('id') id: number) {
    return this.jobPositionService.findOne(id);
  }

  @Delete(':id')
  @MasterAccess('delete-jobposition')
  @JobPositionSwagger.Delete()
  async delete(@Param('id') id: number) {
    return this.jobPositionService.delete(id);
  }

  @Post('push-to-tenants')
  @MasterAccess('view-jobposition')
  @JobPositionSwagger.PushToTenants()
  async pushToTenants(@Body() dto: PushJobPositionDto) {
    return await this.jobPositionService.pushToTenants(dto);
  }
}
