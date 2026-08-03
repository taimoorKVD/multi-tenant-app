import {Global, Module} from '@nestjs/common';
import {GeoDataService} from './geo-data.service';

@Global()
@Module({
  providers: [GeoDataService],
  exports: [GeoDataService],
})
export class GeoDataModule {}
