import {Module} from '@nestjs/common';
import {UsersService} from './users.service';
import {UsersController} from './users.controller';
import {APP_GUARD} from '@nestjs/core';
import {TenantPermissionsGuard} from "../../common/guards";

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: APP_GUARD,
      useClass: TenantPermissionsGuard,
    },
  ],
})
export class UsersModule {}