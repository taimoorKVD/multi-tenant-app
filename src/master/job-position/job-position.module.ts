import {Module} from '@nestjs/common';
import {JobPositionService} from './job-position.service';
import {JobPositionController} from './job-position.controller';
import {JobPosition} from "./entities";
import {Tenant} from "../tenants/entities";
import {TypeOrmModule} from "@nestjs/typeorm";

@Module({
  imports: [TypeOrmModule.forFeature([JobPosition, Tenant])],
  controllers: [JobPositionController],
  providers: [JobPositionService],
  exports: [JobPositionService],
})
export class JobPositionModule {
}
