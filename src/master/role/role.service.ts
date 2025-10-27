import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {MasterAbstractService} from '../../common/abstract';
import {Role} from './entities';

@Injectable()
export class RoleService extends MasterAbstractService<Role> {
    constructor(@InjectRepository(Role) repo: Repository<Role>) {
        super(repo);
    }
}
