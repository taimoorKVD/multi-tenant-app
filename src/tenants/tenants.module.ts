import {Module} from '@nestjs/common';
import {TenantAuthModule} from './auth/auth.module';
import {UsersModule} from './users/users.module';
import {RoleModule} from './role/role.module';
import {PermissionModule} from './permission/permission.module';

@Module({
  imports: [TenantAuthModule, UsersModule, RoleModule, PermissionModule],
})
export class TenantsModule {
}
