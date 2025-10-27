import {Injectable} from '@nestjs/common';
import {Role} from './entities';
import {DataSource} from 'typeorm';
import {TenantAbstractService} from '../../common/abstract';

@Injectable()
export class RoleService extends TenantAbstractService<Role> {

    constructor(private readonly dataSource: DataSource) {
        super(dataSource.getRepository(Role));
    }
}
