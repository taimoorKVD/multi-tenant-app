import {Module} from '@nestjs/common';
import {JobPositionService} from './job-position.service';
import {JobPositionController} from './job-position.controller';

@Module({
  controllers: [JobPositionController],
  providers: [JobPositionService],
  exports: [JobPositionService],
})
export class JobPositionModule {
}
