import {Injectable} from '@nestjs/common';
import {DataSource} from 'typeorm';
import {JobPosition} from './entities';
import {TenantAbstractService} from "../../common/abstract";

@Injectable()
export class JobPositionsService extends TenantAbstractService<JobPosition> {
    constructor(private readonly dataSource: DataSource) {
        super(dataSource.getRepository(JobPosition));
    }
}
