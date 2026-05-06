import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import {CitiesService} from './cities.service';
import {CreateCityDto, UpdateCityDto} from './dto';
import {CitiesSwagger} from './swagger';

@ApiTags('City Management')
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Post()
  @CitiesSwagger.Create()
  create(@Body() dto: CreateCityDto) {
    return this.citiesService.create(dto);
  }

  @Get('search')
  @CitiesSwagger.Search()
  search(
    @Query('q') q: string,
    @Query('state_id') stateId?: number,
    @Query('limit') limit?: number,
  ) {
    return this.citiesService.search(q, Number(limit) || 10, stateId ? Number(stateId) : undefined);
  }

  @Get()
  @CitiesSwagger.FindAll()
  findAll(
    @Query('state_id') stateId?: number,
    @Query('page') page = 1,
    @Query('limit') limit = 15,
  ) {
    return this.citiesService.findAll(
      Number(page),
      Number(limit),
      stateId ? Number(stateId) : undefined,
    );
  }

  @Get(':id')
  @CitiesSwagger.FindOne()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.citiesService.findOne(id);
  }

  @Patch(':id')
  @CitiesSwagger.Update()
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCityDto) {
    return this.citiesService.update(id, dto);
  }

  @Delete(':id')
  @CitiesSwagger.Delete()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.citiesService.remove(id);
  }
}