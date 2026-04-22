import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import {CountriesService} from './countries.service';
import {CreateCountryDto, UpdateCountryDto} from './dto';
import {CountriesSwagger} from './swagger';

@ApiTags('Country Management')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Post()
  @CountriesSwagger.Create()
  create(@Body() dto: CreateCountryDto) {
    return this.countriesService.create(dto);
  }

  @Get('search')
  @CountriesSwagger.Search()
  search(@Query('q') q: string, @Query('limit') limit?: number) {
    return this.countriesService.search(q, limit);
  }

  @Get()
  @CountriesSwagger.FindAll()
  findAll(@Query('page') page = 1, @Query('limit') limit = 15) {
    return this.countriesService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  @CountriesSwagger.FindOne()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.countriesService.findOne(id);
  }

  @Patch(':id')
  @CountriesSwagger.Update()
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCountryDto) {
    return this.countriesService.update(id, dto);
  }

  @Delete(':id')
  @CountriesSwagger.Delete()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.countriesService.remove(id);
  }
}
