import {Module} from '@nestjs/common';
import {JobPositionController} from './job-positions.controller';
import {JobPositionsService} from './job-positions.service';
import {TenantAuthModule} from '../auth/auth.module';

@Module({
    imports: [TenantAuthModule],
    controllers: [JobPositionController],
    providers: [JobPositionsService],
    exports: [JobPositionsService],
})
export class JobPositionsModule {
}
