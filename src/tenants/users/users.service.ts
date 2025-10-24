import {Injectable} from '@nestjs/common';
import {DataSource} from 'typeorm';
import {User} from "./entities";
import {AbstractService} from "../../common/abstract.service";

@Injectable()
export class UsersService extends AbstractService<User> {
    constructor(private readonly dataSource: DataSource) {
        super(dataSource.getRepository(User));
    }
}
