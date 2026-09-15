import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentStatus,
  AssignmentType,
  DataCollectionAssignment,
  DataCollectionSubmission,
  DataCollectionTemplate,
  SubmissionStatus,
  TemplateVersion,
} from '../entities';
import { CreateSubmissionDto, UpdateSubmissionDto } from '../dto/submissions/submission.dto';
import { QuerySubmissionDto } from '../dto/submissions/query-submission.dto';
import { WorkflowActionsService } from './workflow-actions.service';

@Injectable()
export class SubmissionsService {
  constructor(private readonly workflowActions: WorkflowActionsService) {}

  private getActorId(req: any): number | null {
    const candidate = req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) return null;
    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  private collectRequiredFieldIds(schema: Record<string, any> | null): string[] {
    const required: string[] = [];
    const sections = Array.isArray(schema?.sections) ? schema.sections : [];
    for (const section of sections) {
      for (const row of section.rows || []) {
        for (const field of row.fields || []) {
          if (field?.required && field?.id) required.push(String(field.id));
        }
      }
    }
    return required;
  }

  private validateAnswers(schema: Record<string, any> | null, answers: Record<string, any>, submit: boolean) {
    if (!submit) return;
    const requiredIds = this.collectRequiredFieldIds(schema);
    const missing = requiredIds.filter((id) => {
      const value = answers?.[id];
      if (value === undefined || value === null) return true;
      if (typeof value === 'string' && value.trim() === '') return true;
      if (Array.isArray(value) && value.length === 0) return true;
      return false;
    });
    if (missing.length) {
      throw new BadRequestException(`Missing required answers for fields: ${missing.join(', ')}`);
    }
  }

  private async assertSharedGroupOpen(
    assignmentRepo: any,
    assignment: DataCollectionAssignment,
  ) {
    if (
      assignment.assignmentType !== AssignmentType.SHARED ||
      !assignment.sharedGroupKey
    ) {
      return;
    }

    const siblingCompleted = await assignmentRepo.findOne({
      where: {
        sharedGroupKey: assignment.sharedGroupKey,
        status: AssignmentStatus.COMPLETED,
      },
    });
    if (siblingCompleted) {
      throw new BadRequestException('This shared task was already completed by another user');
    }
  }

  /**
   * Mark the assignment (and shared siblings) completed by the submitting user.
   */
  private async markAssignmentCompleted(
    assignmentRepo: any,
    assignment: DataCollectionAssignment,
    actorId: number | null,
    completedAt: Date,
  ) {
    if (
      assignment.assignmentType === AssignmentType.SHARED &&
      assignment.sharedGroupKey
    ) {
      await assignmentRepo
        .createQueryBuilder()
        .update(DataCollectionAssignment)
        .set({
          status: AssignmentStatus.COMPLETED,
          completedByUserId: actorId,
          completedAt,
          updatedBy: actorId,
        })
        .where('shared_group_key = :sharedGroupKey', {
          sharedGroupKey: assignment.sharedGroupKey,
        })
        .andWhere('status IN (:...statuses)', {
          statuses: [
            AssignmentStatus.PENDING,
            AssignmentStatus.IN_PROGRESS,
            AssignmentStatus.OVERDUE,
          ],
        })
        .execute();

      // Keep in-memory row consistent for callers.
      assignment.status = AssignmentStatus.COMPLETED;
      assignment.completedByUserId = actorId;
      assignment.completedAt = completedAt;
      assignment.updatedBy = actorId;
      return;
    }

    assignment.status = AssignmentStatus.COMPLETED;
    assignment.completedByUserId = actorId;
    assignment.completedAt = completedAt;
    assignment.updatedBy = actorId;
    await assignmentRepo.save(assignment);
  }

  async create(req: any, assignmentId: number, dto: CreateSubmissionDto) {
    try {
      const assignmentRepo = req.tenantConnection.getRepository(DataCollectionAssignment);
      const submissionRepo = req.tenantConnection.getRepository(DataCollectionSubmission);
      const versionRepo = req.tenantConnection.getRepository(TemplateVersion);
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);

      const assignment = await assignmentRepo.findOne({ where: { id: assignmentId } });
      if (!assignment) throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);

      if (assignment.status === AssignmentStatus.CANCELLED) {
        throw new BadRequestException('Cannot submit a cancelled assignment');
      }
      if (assignment.status === AssignmentStatus.COMPLETED) {
        throw new BadRequestException('Assignment is already completed');
      }

      await this.assertSharedGroupOpen(assignmentRepo, assignment);

      const version = await versionRepo.findOne({ where: { id: assignment.templateVersionId } });
      if (!version) throw new NotFoundException('Template version for assignment not found');

      const existing = await submissionRepo.findOne({
        where: { assignmentId, status: SubmissionStatus.SUBMITTED },
      });
      if (existing) {
        throw new BadRequestException('A submission already exists for this assignment');
      }

      const shouldSubmit = dto.submit !== false;
      this.validateAnswers(version.schemaSnapshot, dto.answers || {}, shouldSubmit);

      const actorId = this.getActorId(req);
      const submission = submissionRepo.create({
        assignmentId,
        templateVersionId: version.id,
        submittedBy: actorId,
        answers: dto.answers || {},
        status: shouldSubmit ? SubmissionStatus.SUBMITTED : SubmissionStatus.DRAFT,
        submittedAt: shouldSubmit ? new Date() : null,
        createdBy: actorId,
        updatedBy: actorId,
      });

      const saved = await submissionRepo.save(submission);

      let workflowResult: Awaited<ReturnType<WorkflowActionsService['runAfterSubmit']>> | undefined;
      if (shouldSubmit) {
        const completedAt = saved.submittedAt || new Date();
        await this.markAssignmentCompleted(assignmentRepo, assignment, actorId, completedAt);

        const template = await templateRepo.findOne({ where: { id: assignment.templateId } });
        workflowResult = await this.workflowActions.runAfterSubmit(req, {
          templateId: assignment.templateId,
          templateName: template?.name || '',
          assignmentId: assignment.id,
          submissionId: saved.id,
          schema: (version.schemaSnapshot || template?.schema || {}) as Record<string, any>,
          submittedBy: actorId,
        });
      }

      return {
        success: true,
        message: shouldSubmit ? 'Submission saved' : 'Draft submission saved',
        data: saved,
        workflow: workflowResult,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Submission create failed:', error);
      throw new InternalServerErrorException('Failed to create submission');
    }
  }

  async update(req: any, id: number, dto: UpdateSubmissionDto) {
    try {
      const submissionRepo = req.tenantConnection.getRepository(DataCollectionSubmission);
      const assignmentRepo = req.tenantConnection.getRepository(DataCollectionAssignment);
      const versionRepo = req.tenantConnection.getRepository(TemplateVersion);
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);

      const submission = await submissionRepo.findOne({ where: { id } });
      if (!submission) throw new NotFoundException(`Submission with ID ${id} not found`);

      if (submission.status === SubmissionStatus.SUBMITTED && dto.submit !== false) {
        throw new BadRequestException('Submission is already finalized');
      }

      const version = await versionRepo.findOne({ where: { id: submission.templateVersionId } });
      if (!version) throw new NotFoundException('Template version not found');

      const actorId = this.getActorId(req);
      if (dto.answers !== undefined) submission.answers = dto.answers;

      const shouldSubmit = dto.submit === true;
      let assignment: DataCollectionAssignment | null = null;
      if (shouldSubmit) {
        assignment = await assignmentRepo.findOne({ where: { id: submission.assignmentId } });
        if (!assignment) {
          throw new NotFoundException(`Assignment with ID ${submission.assignmentId} not found`);
        }
        if (assignment.status === AssignmentStatus.CANCELLED) {
          throw new BadRequestException('Cannot submit a cancelled assignment');
        }
        if (assignment.status === AssignmentStatus.COMPLETED) {
          throw new BadRequestException('Assignment is already completed');
        }
        await this.assertSharedGroupOpen(assignmentRepo, assignment);
        this.validateAnswers(version.schemaSnapshot, submission.answers || {}, true);
        submission.status = SubmissionStatus.SUBMITTED;
        submission.submittedAt = new Date();
        submission.submittedBy = actorId;
      }

      submission.updatedBy = actorId;
      const saved = await submissionRepo.save(submission);

      let workflowResult: Awaited<ReturnType<WorkflowActionsService['runAfterSubmit']>> | undefined;
      if (shouldSubmit && assignment) {
        const completedAt = saved.submittedAt || new Date();
        await this.markAssignmentCompleted(assignmentRepo, assignment, actorId, completedAt);

        const template = await templateRepo.findOne({ where: { id: assignment.templateId } });
        workflowResult = await this.workflowActions.runAfterSubmit(req, {
          templateId: assignment.templateId,
          templateName: template?.name || '',
          assignmentId: assignment.id,
          submissionId: saved.id,
          schema: (version.schemaSnapshot || template?.schema || {}) as Record<string, any>,
          submittedBy: actorId,
        });
      }

      return {
        success: true,
        message: shouldSubmit ? 'Submission submitted' : 'Submission updated',
        data: saved,
        workflow: workflowResult,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to update submission');
    }
  }

  async findAll(req: any, query: QuerySubmissionDto) {
    try {
      const submissionRepo = req.tenantConnection.getRepository(DataCollectionSubmission);
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(Math.max(1, query.limit ?? 15), 100);
      const skip = (page - 1) * limit;

      const qb = submissionRepo.createQueryBuilder('submission');

      if (query.status) {
        qb.andWhere('submission.status = :status', { status: query.status });
      }
      if (query.assignmentId) {
        qb.andWhere('submission.assignmentId = :assignmentId', { assignmentId: query.assignmentId });
      }
      if (query.templateId) {
        qb.innerJoin(
          DataCollectionAssignment,
          'assignment',
          'assignment.id = submission.assignmentId',
        ).andWhere('assignment.templateId = :templateId', { templateId: query.templateId });
      }

      qb.orderBy('submission.createdAt', 'DESC').skip(skip).take(limit);
      const [data, total] = await qb.getManyAndCount();
      const lastPage = Math.ceil(total / limit) || 1;

      return { success: true, meta: { total, page, lastPage }, data };
    } catch (error) {
      console.error('Submission findAll failed:', error);
      throw new InternalServerErrorException('Failed to retrieve submissions');
    }
  }

  async findOne(req: any, id: number) {
    try {
      const submissionRepo = req.tenantConnection.getRepository(DataCollectionSubmission);
      const submission = await submissionRepo.findOne({ where: { id } });
      if (!submission) throw new NotFoundException(`Submission with ID ${id} not found`);
      return { success: true, data: submission };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve submission');
    }
  }
}
