import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {MasterAbstractService} from '../../common/abstract';
import {JobPosition} from './entities';
import {CreateJobPositionDto, UpdateJobPositionDto} from './dto';

@Injectable()
export class JobPositionService extends MasterAbstractService<JobPosition> {
    constructor(
        @InjectRepository(JobPosition)
        private readonly jobPositionRepo: Repository<JobPosition>,
    ) {
        super(jobPositionRepo);
    }

    async create(dto: CreateJobPositionDto) {
        try {
            const {name, description} = dto;

            const existing = await this.jobPositionRepo.findOne({where: {name}});
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
            const jobPosition = await this.jobPositionRepo.findOne({where: {id}});
            if (!jobPosition) {
                throw new NotFoundException('Job position not found.');
            }

            // Update fields if provided
            if (dto.name && dto.name !== jobPosition.name) {
                const existing = await this.jobPositionRepo.findOne({where: {name: dto.name}});
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
}
