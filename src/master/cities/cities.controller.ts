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
    @Query('name') name?: string,
    @Query('state_id') stateId?: number,
    @Query('country_id') countryId?: number,
    @Query('limit') limit?: number,
  ) {
    return this.citiesService.search(
      limit !== undefined ? Number(limit) : undefined,
      {
        name,
        stateId: stateId ? Number(stateId) : undefined,
        countryId: countryId ? Number(countryId) : undefined,
      },
    );
  }

  @Get()
  @CitiesSwagger.FindAll()
  findAll(
    @Query('state_id') stateId?: number,
    @Query('country_id') countryId?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const parsedPage = Number(page);
    const parsedLimit = limit === undefined ? undefined : Number(limit);

    return this.citiesService.findAll(
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      {
        stateId: stateId ? Number(stateId) : undefined,
        countryId: countryId ? Number(countryId) : undefined,
      },
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
