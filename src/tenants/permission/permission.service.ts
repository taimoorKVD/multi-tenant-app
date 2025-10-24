import {Injectable} from '@nestjs/common';
import {Permission} from './entities';
import {DataSource} from 'typeorm';
import {AbstractService} from 'src/common/abstract.service';

@Injectable()
export class PermissionService extends AbstractService<Permission> {

    constructor(private readonly dataSource: DataSource) {
        super(dataSource.getRepository(Permission));
    }
}
