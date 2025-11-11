import {Module} from '@nestjs/common';
import {LocationsController} from './location.controller';
import {LocationsService} from './locations.service';

@Module({
    controllers: [LocationsController],
    providers: [LocationsService],
    exports: [LocationsService],
})
export class LocationsModule {
}