import { Module } from '@nestjs/common';
import { JobPositionService } from './job-position.service';
import { JobPositionController } from './job-position.controller';
import { MasterAuthModule } from '../auth/auth.module';

@Module({
  imports: [MasterAuthModule],
  controllers: [JobPositionController],
  providers: [JobPositionService],
})
export class JobPositionModule {}
