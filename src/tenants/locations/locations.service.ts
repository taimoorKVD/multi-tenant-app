import {Injectable, InternalServerErrorException} from '@nestjs/common';
import {DataSource} from 'typeorm';
import {Location} from './entities';
import {TenantAbstractService} from "../../common/abstract";

@Injectable()
export class LocationsService extends TenantAbstractService<Location> {
    constructor(private readonly dataSource: DataSource) {
        super(dataSource.getRepository(Location));
    }

    private normalizeLocationPayload(payload: any) {
        if (!payload || typeof payload !== 'object') {
            return payload;
        }

        const {country_id, state_id, city_id, ...rest} = payload;

        return {
            ...rest,
            countryId: rest.countryId ?? country_id,
            stateId: rest.stateId ?? state_id,
            cityId: rest.cityId ?? city_id,
        };
    }

    async create(req: any, data: any): Promise<any> {
        return super.create(req, this.normalizeLocationPayload(data));
    }

    async update(req: any, id: number, data: any): Promise<any> {
        return super.update(req, id, this.normalizeLocationPayload(data));
    }

    async search(
        req: any,
        limit = 15,
        filters?: {
            name?: string;
            address?: string;
            postalCode?: string;
            countryId?: number;
            stateId?: number;
            cityId?: number;
        },
    ): Promise<any> {
        try {
            const locationRepo = this.getRepo(req);
            const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);
            const name = filters?.name?.trim();
            const address = filters?.address?.trim();
            const postalCode = filters?.postalCode?.trim();
            const countryId = filters?.countryId;
            const stateId = filters?.stateId;
            const cityId = filters?.cityId;
            const hasFilters = Boolean(name || address || postalCode || countryId || stateId || cityId);

            if (!hasFilters) {
                return {
                    success: true,
                    tenant: req.tenantConnection.options.database,
                    count: 0,
                    data: [],
                };
            }

            const qb = locationRepo.createQueryBuilder('location');

            if (name) {
                qb.andWhere('location.name ILIKE :name', {name: `%${name}%`});
            }

            if (address) {
                qb.andWhere('location.address ILIKE :address', {address: `%${address}%`});
            }

            if (postalCode) {
                qb.andWhere('location."postalCode" ILIKE :postalCode', {
                    postalCode: `%${postalCode}%`,
                });
            }

            if (countryId) {
                qb.andWhere('location.country_id = :countryId', {countryId});
            }

            if (stateId) {
                qb.andWhere('location.state_id = :stateId', {stateId});
            }

            if (cityId) {
                qb.andWhere('location.city_id = :cityId', {cityId});
            }

            const locations = await qb.orderBy('location.id', 'DESC').take(take).getMany();

            const data = locations.map((location) => ({
                id: location.id,
                name: location.name,
                address: location.address,
                country_id: location.countryId,
                state_id: location.stateId,
                city_id: location.cityId,
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
            throw new InternalServerErrorException(
                `Failed to search tenant locations: ${(error as Error).message}`,
            );
        }
    }
}
