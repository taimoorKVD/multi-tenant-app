import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateSubmissionDto } from '../dto';
import { Form, FormField, FormStatus, FormSubmission, FormVersion } from '../entities';
import { SubmissionIndexService } from './submission-index.service';
import { ValidationService } from './validation.service';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly submissionIndexService: SubmissionIndexService,
    private readonly validationService: ValidationService,
  ) {}

  private actor(req: any, fallback?: number): number | null {
    const candidate = fallback ?? req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) {
      return null;
    }

    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  async submit(req: any, formId: number, dto: CreateSubmissionDto) {
    const formRepo = req.tenantConnection.getRepository(Form);
    const versionRepo = req.tenantConnection.getRepository(FormVersion);
    const fieldRepo = req.tenantConnection.getRepository(FormField);

    const form = await formRepo.findOne({ where: { id: formId } });
    if (!form) throw new NotFoundException('Form not found');

    const version = dto.versionId
      ? await versionRepo.findOne({ where: { id: dto.versionId, formId } })
      : await versionRepo.findOne({
          where: { formId, isActive: true },
          order: { versionNumber: 'DESC' },
        });

    if (!version) {
      throw new NotFoundException('Active form version not found. Publish the form first.');
    }

    const schemaFields = Array.isArray(version.schemaSnapshot?.fields)
      ? version.schemaSnapshot.fields
      : [];

    if (schemaFields.length) {
      this.validationService.validateSubmission(schemaFields, dto.submissionData || {});
    } else {
      // Backward-compatible fallback for old relationally built forms.
      const fields = await fieldRepo.find({
        where: { formId },
        relations: ['validations'],
        order: { sortOrder: 'ASC' },
      });
      this.validationService.validateSubmission(fields, dto.submissionData || {});
    }

    const actorId = this.actor(req, dto.createdBy);

    let created: FormSubmission | null = null;
    await req.tenantConnection.manager.transaction(async (manager) => {
      const submissionRepo = manager.getRepository(FormSubmission);
      const savedSubmission = await submissionRepo.save(
        submissionRepo.create({
          formId,
          versionId: version.id,
          submissionData: dto.submissionData,
          createdBy: actorId,
          updatedBy: actorId,
        }),
      );
      created = savedSubmission;

      await this.submissionIndexService.indexSubmission(
        manager,
        savedSubmission.id,
        dto.submissionData,
        actorId,
      );
    });

    if (!created) {
      throw new NotFoundException('Submission could not be persisted');
    }

    return {
      success: true,
      message: 'Form submission saved successfully',
      data: created,
    };
  }

  async findAll(req: any, formId: number) {
    const repo = req.tenantConnection.getRepository(FormSubmission);
    const data = await repo.find({
      where: { formId },
      order: { createdAt: 'DESC' },
    });

    return { success: true, count: data.length, data };
  }

  async findOne(req: any, id: number) {
    const repo = req.tenantConnection.getRepository(FormSubmission);
    const data = await repo.findOne({
      where: { id },
      relations: ['version', 'files'],
    });

    if (!data) throw new NotFoundException('Submission not found');
    return { success: true, data };
  }
}
