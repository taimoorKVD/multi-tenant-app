import {BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import {DataSource, In} from 'typeorm';
import {JobPosition} from './entities';
import {TenantAbstractService} from '../../common/abstract';
import {Permission} from '../permission/entities';
import {CreateJobPositionDto, UpdateJobPositionDto} from './dto';
import {groupPermissionsByModule} from '../../common/utils/permission-module';
import {PermissionSessionSyncService} from '../auth/permission-session-sync.service';
import {User} from '../users/entities';
import {DataCollectionAssignment, DataCollectionTemplate} from '../data-collection/entities';
import {templateSchemaContainsReference} from '../../common/utils/template-reference.util';

@Injectable()
export class JobPositionsService extends TenantAbstractService<JobPosition> {
    constructor(
        private readonly dataSource: DataSource,
        private readonly permissionSessionSync: PermissionSessionSyncService,
    ) {
        super(dataSource.getRepository(JobPosition));
    }

    private async findUserIdsByJobPosition(req: any, jobPositionId: number): Promise<number[]> {
        const users = await req.tenantConnection.getRepository(User).find({
            where: {jobPosition: {id: jobPositionId}} as any,
            select: ['id'],
        });
        return users.map((user: User) => user.id);
    }

    private async resolvePermissions(req: any, permissionIds: number[] = []): Promise<Permission[]> {
        if (!permissionIds.length) return [];

        const repo = this.getRepo(req).manager.getRepository(Permission);
        const permissions = await repo.find({where: {id: In(permissionIds)}});

        if (permissions.length !== permissionIds.length) {
            throw new BadRequestException('One or more permission IDs are invalid.');
        }

        return permissions;
    }

    private withGroupedPermissions<T extends {permissions?: Permission[] | null}>(
        jobPosition: T | null,
    ): (Omit<T, 'permissions'> & {permissions: ReturnType<typeof groupPermissionsByModule>}) | null {
        if (!jobPosition) return null;
        return {
            ...jobPosition,
            permissions: groupPermissionsByModule(jobPosition.permissions || []),
        };
    }

    private withGroupedPermissionsList<T extends {permissions?: Permission[] | null}>(
        jobPositions: T[],
    ) {
        return jobPositions.map(
            (jobPosition) => this.withGroupedPermissions(jobPosition) as NonNullable<
                ReturnType<JobPositionsService['withGroupedPermissions']>
            >,
        );
    }

    async create(req: any, data: CreateJobPositionDto): Promise<any> {
        try {
            const repo = this.getRepo(req);
            const existing = await repo.findOne({where: {name: data.name} as any});
            if (existing) {
                throw new BadRequestException('A job position with this name already exists.');
            }

            const permissions = await this.resolvePermissions(req, data.permissionIds || []);
            const entity = repo.create({
                name: data.name,
                description: data.description ?? null,
                permissions,
            });

            const saved = await repo.save(entity);
            const hydrated = await repo.findOne({
                where: {id: saved.id} as any,
                relations: ['permissions'],
            });

            return {
                success: true,
                message: 'Record created successfully',
                tenant: req.tenantConnection.options.database,
                data: this.withGroupedPermissions(hydrated),
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            console.error('Create job position failed:', error);
            throw new InternalServerErrorException('Failed to create record');
        }
    }

    async findAll(req: any): Promise<any> {
        const result = await super.findAll(req, ['permissions']);
        return {
            ...result,
            data: this.withGroupedPermissionsList(result.data || []),
        };
    }

    async paginate(
        req: any,
        page = 1,
        relations: string[] = ['permissions'],
        limit?: number,
    ): Promise<any> {
        const result = await super.paginate(req, page, relations, limit);
        return {
            ...result,
            data: this.withGroupedPermissionsList(result.data || []),
        };
    }

    async findOne(req: any, id: number): Promise<any> {
        const result = await super.findOne(req, id, ['permissions']);
        return {
            ...result,
            data: this.withGroupedPermissions(result.data),
        };
    }

    async update(req: any, id: number, data: UpdateJobPositionDto): Promise<any> {
        try {
            const repo = this.getRepo(req);
            const entity = await repo.findOne({
                where: {id} as any,
                relations: ['permissions'],
            });

            if (!entity) {
                throw new NotFoundException(`Record with ID ${id} not found`);
            }

            if (data.name && data.name !== entity.name) {
                const duplicate = await repo.findOne({where: {name: data.name} as any});
                if (duplicate && duplicate.id !== id) {
                    throw new BadRequestException('A job position with this name already exists.');
                }
                entity.name = data.name;
            }

            if (data.description !== undefined) {
                entity.description = data.description ?? null;
            }

            const permissionsChanged = data.permissionIds !== undefined;
            if (permissionsChanged) {
                entity.permissions = await this.resolvePermissions(req, data.permissionIds);
            }

            const saved = await repo.save(entity);
            const hydrated = await repo.findOne({
                where: {id: saved.id} as any,
                relations: ['permissions'],
            });

            if (permissionsChanged) {
                const userIds = await this.findUserIdsByJobPosition(req, saved.id);
                await this.permissionSessionSync.syncUsers(req, userIds, {
                    reason: 'job_position_permissions_updated',
                    jobPositionId: saved.id,
                });
            }

            return {
                success: true,
                message: 'Record updated successfully',
                tenant: req.tenantConnection.options.database,
                data: this.withGroupedPermissions(hydrated),
            };
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
            console.error('Update job position failed:', error);
            throw new InternalServerErrorException('Failed to update record');
        }
    }

    async search(
        req: any,
        limit = 15,
        filters?: {
            name?: string;
            description?: string;
            permissionId?: number;
        },
    ): Promise<any> {
        try {
            const repo = this.getRepo(req);
            const parsedLimit = Number(limit);
            const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
            const name = filters?.name?.trim();
            const description = filters?.description?.trim();
            const permissionId = filters?.permissionId;
            const hasFilters = Boolean(name || description || permissionId);

            if (!hasFilters) {
                return {
                    success: true,
                    tenant: req.tenantConnection.options.database,
                    count: 0,
                    data: [],
                };
            }

            const qb = repo
                .createQueryBuilder('jobPosition')
                .leftJoinAndSelect('jobPosition.permissions', 'permission');

            if (name) {
                qb.andWhere('jobPosition.name ILIKE :name', {name: `%${name}%`});
            }

            if (description) {
                qb.andWhere('jobPosition.description ILIKE :description', {
                    description: `%${description}%`,
                });
            }

            if (permissionId) {
                qb.andWhere('permission.id = :permissionId', {permissionId});
            }

            const data = await qb.orderBy('jobPosition.id', 'DESC').take(take).getMany();

            return {
                success: true,
                tenant: req.tenantConnection.options.database,
                count: data.length,
                data: this.withGroupedPermissionsList(data),
            };
        } catch (error) {
            console.error('Tenant job position search failed:', error);
            throw new InternalServerErrorException('Failed to search job positions');
        }
    }

    async delete(req: any, id: number): Promise<any> {
        const userIds = await this.findUserIdsByJobPosition(req, id);
        if (userIds.length) {
            throw new ConflictException(
                'This job position cannot be deleted because it is linked to the user module. Please remove the job position from users first.',
            );
        }
        await this.assertNotLinkedToTemplates(req, [id]);
        return super.delete(req, id);
    }

    async bulkDelete(req: any, ids: number[]): Promise<any> {
        const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
        const linked: Array<{ id: number; userCount: number }> = [];
        for (const id of uniqueIds) {
            const userIds = await this.findUserIdsByJobPosition(req, id);
            if (userIds.length) linked.push({id, userCount: userIds.length});
        }
        if (linked.length) {
            const references = linked.map((item) => `${item.id} (${item.userCount} user(s))`).join(', ');
            throw new ConflictException(
                'These job positions cannot be deleted because they are linked to the user module. Please remove the job positions from users first.',
            );
        }
        await this.assertNotLinkedToTemplates(req, uniqueIds);
        return super.bulkDelete(req, ids);
    }

    private async assertNotLinkedToTemplates(req: any, jobPositionIds: number[]): Promise<void> {
        if (!jobPositionIds.length) return;
        const assignmentRepo = req.tenantConnection.getRepository(DataCollectionAssignment);
        const assignments = await assignmentRepo.find({
            where: {jobPositionId: In(jobPositionIds)} as any,
            select: ['templateId', 'jobPositionId'],
        });
        const templateIds = new Set(assignments.map((row) => row.templateId));

        const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
        const templates = await templateRepo.find();
        const templateLinked = templates.some((template) =>
            templateSchemaContainsReference(template.schema, 'jobpositions', jobPositionIds),
        );
        if (templateLinked) {
            throw new ConflictException(
                jobPositionIds.length === 1
                    ? 'This job position cannot be deleted because it is linked to the Form Template. Please remove this job position from template first.'
                    : 'These job positions cannot be deleted because they are linked to the Form Templates. Please remove the job positions from templates first.',
            );
        }

        if (templateIds.size) {
            throw new ConflictException(
                `This job position cannot be deleted because it is linked to data collection template(s): ${[...templateIds].join(', ')}.`,
            );
        }
    }

    private async assertDeletionLinks(req: any, jobPositionIds: number[], isBulk: boolean): Promise<void> {
        const linkedUserIds = new Set<number>();
        for (const id of jobPositionIds) {
            const userIds = await this.findUserIdsByJobPosition(req, id);
            userIds.forEach((userId) => linkedUserIds.add(userId));
        }

        const assignmentRepo = req.tenantConnection.getRepository(DataCollectionAssignment);
        const assignments = await assignmentRepo.find({
            where: {jobPositionId: In(jobPositionIds)} as any,
            select: ['templateId', 'jobPositionId'],
        });
        const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
        const templates = await templateRepo.find();
        const linkedToTemplate =
            assignments.length > 0 ||
            templates.some((template) => templateSchemaContainsReference(template.schema, 'jobpositions', jobPositionIds));

        if (linkedUserIds.size && linkedToTemplate) {
            throw new ConflictException(
                isBulk
                    ? 'These job positions cannot be deleted because they are linked to users and Form Templates. Please remove the job positions from users and templates first.'
                    : 'This job position cannot be deleted because it is linked to the user module and the Form Template. Please remove this job position from users and the template first.',
            );
        }
        if (linkedUserIds.size) {
            throw new ConflictException(
                isBulk
                    ? 'These job positions cannot be deleted because they are linked to the user module. Please remove the job positions from users first.'
                    : 'This job position cannot be deleted because it is linked to the user module. Please remove this job position from users first.',
            );
        }
        if (linkedToTemplate) {
            throw new ConflictException(
                isBulk
                    ? 'These job positions cannot be deleted because they are linked to Form Templates. Please remove the job positions from templates first.'
                    : 'This job position cannot be deleted because it is linked to the Form Template. Please remove this job position from the template first.',
            );
        }
    }
}
