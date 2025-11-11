import {Module} from '@nestjs/common';
import {JobPositionController} from './job-positions.controller';
import {JobPositionsService} from './job-positions.service';

@Module({
    controllers: [JobPositionController],
    providers: [JobPositionsService],
    exports: [JobPositionsService],
})
export class JobPositionsModule {
}