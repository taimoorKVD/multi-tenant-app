import {Module} from '@nestjs/common';
import {RoleController} from './role.controller';
import {RoleService} from './role.service';
import {TenantAuthModule} from '../auth/auth.module';

@Module({
  imports: [TenantAuthModule],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {
}
