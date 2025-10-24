import {Injectable} from '@nestjs/common';
import {Role} from './entities';
import {DataSource} from 'typeorm';
import {AbstractService} from 'src/common/abstract.service';

@Injectable()
export class RoleService extends AbstractService<Role> {

    constructor(private readonly dataSource: DataSource) {
        super(dataSource.getRepository(Role));
    }
}
