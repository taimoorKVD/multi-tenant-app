import {Module} from '@nestjs/common';
import {TenantAuthModule} from './auth/auth.module';
import {UsersModule} from './users/users.module';
import {RoleModule} from './role/role.module';
import {PermissionModule} from './permission/permission.module';
import {LocationsModule} from "./locations/locations.module";
import {JobPositionsModule} from "./job-positions/job-positions.module";
import {VendorsModule} from './vendors/vendors.module';
import { TenantMailAdminModule } from './mail/tenant-mail-admin.module';
import { ReportingGroupsModule } from './reporting-groups/reporting-groups.module';
import { ReportingCategoriesModule } from './reporting-categories/reporting-categories.module';
import { ItemsModule } from './items/items.module';
import { FormBuilderModule } from './form-builder';

@Module({
  imports: [
    TenantAuthModule,
    UsersModule,
    RoleModule,
    PermissionModule,
    LocationsModule,
    JobPositionsModule,
    VendorsModule,
    TenantMailAdminModule,
    ReportingGroupsModule,
    ReportingCategoriesModule,
    ItemsModule,
    FormBuilderModule,
  ],
})
export class TenantsModule {
}
