import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TimezonesService } from './timezones.service';
import { TimezonesSwagger } from './swagger';

@ApiTags('Timezone Management')
@Controller('timezones')
export class TimezonesController {
  constructor(private readonly timezonesService: TimezonesService) {}

  @Get('search')
  @TimezonesSwagger.Search()
  search(
    @Query('q') q?: string,
    @Query('name') name?: string,
    @Query('region') region?: string,
    @Query('limit') limit?: number,
  ) {
    return this.timezonesService.search(limit !== undefined ? Number(limit) : undefined, {
      q,
      name,
      region,
    });
  }

  @Get()
  @TimezonesSwagger.FindAll()
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    const parsedPage = Number(page);
    const parsedLimit = limit === undefined ? undefined : Number(limit);

    return this.timezonesService.findAll(
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @Get(':id')
  @TimezonesSwagger.FindOne()
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const result = await this.timezonesService.findOne(id);
    if (!result) throw new NotFoundException('Timezone not found.');
    return result;
  }
}
