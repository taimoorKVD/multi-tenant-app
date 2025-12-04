import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, In, QueryRunner, Repository} from 'typeorm';
import {MasterAbstractService} from '../../common/abstract';
import {JobPosition} from './entities';
import {JobPosition as TenantJobPosition} from '../../tenants/job-positions/entities';
import {CreateJobPositionDto, PushJobPositionDto, UpdateJobPositionDto} from './dto';
import {getTenantDataSource} from "../../database/datasource";
import {Logger} from "../../database/helpers/logger";
import {Tenant} from "../tenants/entities";

@Injectable()
export class JobPositionService extends MasterAbstractService<JobPosition> {
  constructor(
      @InjectRepository(JobPosition)
      private readonly jobPositionRepo: Repository<JobPosition>,

      @InjectRepository(Tenant)
      private readonly tenantRepo: Repository<Tenant>,
  ) {
    super(jobPositionRepo);
  }

  async create(dto: CreateJobPositionDto) {
    try {
      const { name, description } = dto;

      const existing = await this.jobPositionRepo.findOne({ where: { name } });
      if (existing) {
        throw new BadRequestException('A job position with this name already exists.');
      }

      const jobPosition = this.jobPositionRepo.create({
        name,
        description: description || null,
      });

      const saved = await this.jobPositionRepo.save(jobPosition);

      return {
        success: true,
        message: 'Job position created successfully',
        data: saved,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create job position: ${error.message}`);
    }
  }

  async update(id: number, dto: UpdateJobPositionDto) {
    try {
      const jobPosition = await this.jobPositionRepo.findOne({ where: { id } });
      if (!jobPosition) {
        throw new NotFoundException('Job position not found.');
      }

      if (dto.name && dto.name !== jobPosition.name) {
        const existing = await this.jobPositionRepo.findOne({ where: { name: dto.name } });
        if (existing && existing.id !== id) {
          throw new BadRequestException('Another job position with this name already exists.');
        }
        jobPosition.name = dto.name;
      }

      if (dto.description !== undefined) {
        jobPosition.description = dto.description;
      }

      const saved = await this.jobPositionRepo.save(jobPosition);

      return {
        success: true,
        message: 'Job position updated successfully',
        data: saved,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to update job position: ${error.message}`);
    }
  }

  async pushToTenants(dto: PushJobPositionDto) {
    const {jobPositionIds, tenantIds} = dto;
    const jobPositions = await this.jobPositionRepo.find({
      where: {id: In(jobPositionIds)},
    });
    if (!jobPositions.length) throw new NotFoundException('No job positions found.');

    const tenants = await this.tenantRepo.find({
      where: {id: In(tenantIds)},
    });
    const tenantIdsFound = tenants.map((t) => t.id);
    const missingTenants = tenantIds.filter((id) => !tenantIdsFound.includes(id));
    const results: {
      tenant: string;
      status: string;
      createdCount?: number;
      existedCount?: number;
      message?: string;
    }[] = [];

    for (const tenant of tenants) {
      const tenantName = tenant.name;
      const tenantDb = tenant.dbName;
      let queryRunner: QueryRunner | null = null;

      try {
        const tenantDS: DataSource = await getTenantDataSource(tenantDb);
        await this.ensureJobPositionsTable(tenantDS);

        queryRunner = tenantDS.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        const tenantJobRepo = queryRunner.manager.getRepository(TenantJobPosition);

        let createdCount = 0;
        let existedCount = 0;

        for (const jp of jobPositions) {
          const exists = await tenantJobRepo.findOne({where: {name: jp.name}});
          if (!exists) {
            const entity = tenantJobRepo.create({
              name: jp.name,
              description: jp.description,
              createdAt: new Date(),
            });
            await tenantJobRepo.save(entity);
            createdCount++;
          } else {
            existedCount++;
          }
        }

        await queryRunner.commitTransaction();

        results.push({
          tenant: tenantName,
          status: 'success',
          createdCount,
          existedCount,
        });

        Logger.info(
            `✅ Tenant "${tenantName}" synced successfully | Created: ${createdCount}, Already existed: ${existedCount}`,
        );
      } catch (err) {
        if (queryRunner) await queryRunner.rollbackTransaction();

        Logger.error(`❌ Failed to sync tenant ${tenantName}: ${err.message}`);
        results.push({
          tenant: tenantName,
          status: 'error',
          message: err.message,
        });
      } finally {
        if (queryRunner) await queryRunner.release();
      }
    }

    return {
      summary: {
        totalJobPositions: jobPositions.length,
        totalTenants: tenantIds.length,
        missingTenants,
      },
      results,
    };
  }

  protected async ensureJobPositionsTable(tenantDS: DataSource): Promise<void> {
    const queryRunner = tenantDS.createQueryRunner();
    const hasTable = await queryRunner.hasTable('job_positions');
    await queryRunner.release();
    if (!hasTable) {
      Logger.info(`🗄️ Creating job_positions table for tenant: ${tenantDS.options.database}`);
      await tenantDS.synchronize();
      Logger.info(`✅ job_positions table created successfully.`);
    }
  }
}
