import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {MasterAbstractService} from '../../common/abstract';
import {Permission} from './entities';

@Injectable()
export class PermissionService extends MasterAbstractService<Permission> {
    constructor(@InjectRepository(Permission) repo: Repository<Permission>) {
        super(repo);
    }
}
