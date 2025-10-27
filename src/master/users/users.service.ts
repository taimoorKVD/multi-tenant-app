import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {MasterAbstractService} from '../../common/abstract';
import {User} from './entities';

@Injectable()
export class UsersService extends MasterAbstractService<User> {
    constructor(@InjectRepository(User) repo: Repository<User>) {
        super(repo);
    }
}
