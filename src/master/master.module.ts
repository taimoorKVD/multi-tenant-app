import {Module} from '@nestjs/common';
import {MasterAuthModule} from './auth/auth.module';
import {UsersModule} from './users/users.module';
import {RoleModule} from './role/role.module';
import {PermissionModule} from './permission/permission.module';
import {TenantsModule} from './tenants/tenants.module';
import {JobPositionModule} from './job-position/job-position.module';
import {MasterDatabaseModule} from "../database";
import {TenantsService} from "./tenants/tenants.service";
import {JwtService} from "@nestjs/jwt";

@Module({
  imports: [
    MasterDatabaseModule,
    MasterAuthModule,
    PermissionModule,
    RoleModule,
    UsersModule,
    TenantsModule,
    JobPositionModule,
  ],
  providers: [TenantsService, JwtService],
  exports: [TenantsService, JwtService],
})
export class MasterModule {}
