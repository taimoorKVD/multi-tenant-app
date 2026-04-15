import {Injectable, InternalServerErrorException} from '@nestjs/common';
import {DataSource, ILike} from 'typeorm';
import {Location} from './entities';
import {TenantAbstractService} from "../../common/abstract";

@Injectable()
export class LocationsService extends TenantAbstractService<Location> {
    constructor(private readonly dataSource: DataSource) {
        super(dataSource.getRepository(Location));
    }

    async search(req: any, query: string, limit = 15): Promise<any> {
        try {
            const locationRepo = this.getRepo(req);
            const keyword = (query || '').trim();
            const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);

            if (!keyword) {
                return {
                    success: true,
                    tenant: req.tenantConnection.options.database,
                    count: 0,
                    data: [],
                };
            }

            const locations = await locationRepo.find({
                where: [
                    {name: ILike(`%${keyword}%`)},
                    {address: ILike(`%${keyword}%`)},
                    {city: ILike(`%${keyword}%`)},
                    {country: ILike(`%${keyword}%`)},
                    {postalCode: ILike(`%${keyword}%`)},
                ],
                order: {name: 'ASC'},
                take,
            });

            const data = locations.map((location) => ({
                id: location.id,
                name: location.name,
                address: location.address,
                city: location.city,
                country: location.country,
                postalCode: location.postalCode,
                latitude: location.latitude,
                longitude: location.longitude,
            }));

            return {
                success: true,
                tenant: req.tenantConnection.options.database,
                count: data.length,
                data,
            };
        } catch (error) {
            console.error('Tenant location search failed:', error);
            throw new InternalServerErrorException(`Failed to search tenant locations: ${error.message}`);
        }
    }
}
