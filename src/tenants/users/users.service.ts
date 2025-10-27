import {Injectable} from '@nestjs/common';
import {DataSource} from 'typeorm';
import {User} from "./entities";
import {TenantAbstractService} from "../../common/abstract";

@Injectable()
export class UsersService extends TenantAbstractService<User> {
    constructor(private readonly dataSource: DataSource) {
        super(dataSource.getRepository(User));
    }
}
