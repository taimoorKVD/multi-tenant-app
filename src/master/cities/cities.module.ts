import {Module} from '@nestjs/common';
import {CitiesController} from './cities.controller';
import {CitiesService} from './cities.service';

@Module({
  controllers: [CitiesController],
  providers: [CitiesService],
  exports: [CitiesService],
})
export class CitiesModule {}