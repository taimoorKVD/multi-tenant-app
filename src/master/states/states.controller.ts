import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import {StatesService} from './states.service';
import {CreateStateDto, UpdateStateDto} from './dto';
import {StatesSwagger} from './swagger';

@ApiTags('State Management')
@Controller('states')
export class StatesController {
  constructor(private readonly statesService: StatesService) {}

  @Post()
  @StatesSwagger.Create()
  create(@Body() dto: CreateStateDto) {
    return this.statesService.create(dto);
  }

  @Get('search')
  @StatesSwagger.Search()
  search(
    @Query('q') q: string,
    @Query('country_id') countryId?: number,
    @Query('limit') limit?: number,
  ) {
    return this.statesService.search(
      q,
      limit !== undefined ? Number(limit) : undefined,
      countryId ? Number(countryId) : undefined,
    );
  }

  @Get()
  @StatesSwagger.FindAll()
  findAll(
    @Query('country_id') countryId?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const parsedPage = Number(page);
    const parsedLimit = limit === undefined ? undefined : Number(limit);

    return this.statesService.findAll(
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      countryId ? Number(countryId) : undefined,
    );
  }

  @Get(':id')
  @StatesSwagger.FindOne()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.statesService.findOne(id);
  }

  @Patch(':id')
  @StatesSwagger.Update()
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStateDto) {
    return this.statesService.update(id, dto);
  }

  @Delete(':id')
  @StatesSwagger.Delete()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.statesService.remove(id);
  }
}
