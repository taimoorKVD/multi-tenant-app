import {Injectable} from '@nestjs/common';
import {DataSource} from 'typeorm';
import {Location} from './entities';
import {TenantAbstractService} from "../../common/abstract";

@Injectable()
export class LocationsService extends TenantAbstractService<Location> {
    constructor(private readonly dataSource: DataSource) {
        super(dataSource.getRepository(Location));
    }
}
