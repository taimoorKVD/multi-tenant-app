import { Module } from '@nestjs/common';
import { PermissionController } from './permission.controller';
import { PermissionService } from './permission.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permission])
  ],
  controllers: [PermissionController],
  providers: [PermissionService]
})
export class PermissionModule { }
