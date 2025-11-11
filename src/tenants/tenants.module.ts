import {Module} from '@nestjs/common';
import {TenantAuthModule} from './auth/auth.module';
import {UsersModule} from './users/users.module';
import {RoleModule} from './role/role.module';
import {PermissionModule} from './permission/permission.module';
import {LocationsModule} from "./locations/locations.module";
import {JobPositionsModule} from "./job-positions/job-positions.module";

@Module({
  imports: [TenantAuthModule, UsersModule, RoleModule, PermissionModule, LocationsModule, JobPositionsModule],
})
export class TenantsModule {
}
