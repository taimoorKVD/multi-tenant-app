import { Injectable } from '@nestjs/common';
import { Permission } from './entities';
import { DataSource } from 'typeorm';
import { TenantAbstractService } from '../../common/abstract';

@Injectable()
export class PermissionService extends TenantAbstractService<Permission> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(Permission));
  }
}
