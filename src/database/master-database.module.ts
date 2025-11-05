import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../master/tenants/entities';
import { User } from '../master/users/entities';
import { Role } from '../master/role/entities';
import { Permission } from '../master/permission/entities';
import { masterDatabaseConfig } from '../config/master-database.config';
import {JobPosition} from "../master/job-position/entities";

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot(masterDatabaseConfig()),
    TypeOrmModule.forFeature([Tenant, User, Role, Permission, JobPosition]),
  ],
  exports: [TypeOrmModule],
})
export class MasterDatabaseModule {}
