import {Module} from '@nestjs/common';
import {LocationsController} from './location.controller';
import {LocationsService} from './locations.service';
import {DynamicFieldsService} from '../form-builder/services';

@Module({
    controllers: [LocationsController],
    providers: [LocationsService, DynamicFieldsService],
    exports: [LocationsService],
})
export class LocationsModule {
}
