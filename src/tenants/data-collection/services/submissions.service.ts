import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { DC_PERM_REVIEW_SUBMISSION } from '../config/data-collection.constants';
import {
  AssignmentStatus,
  AssignmentType,
  DataCollectionAssignment,
  DataCollectionSubmission,
  DataCollectionSubmissionFlag,
  DataCollectionSubmissionReviewEvent,
  DataCollectionTemplate,
  SubmissionReviewAction,
  SubmissionStatus,
  TemplateStatus,
  TemplateVersion,
} from '../entities';
import { CreateSubmissionDto, UpdateSubmissionDto } from '../dto/submissions/submission.dto';
import { FailSubmissionDto } from '../dto/submissions/submission-flag.dto';
import { QuerySubmissionDto } from '../dto/submissions/query-submission.dto';
import { buildAssignmentCompletion } from '../utils/assignment-completion.util';
import {
  assertSubmissionStatusTransition,
  isFinalizedSubmissionStatus,
  resolveSubmitStatus,
} from '../utils/submission-status.util';
import { User } from '../../users/entities';
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

  private assertTemplateAvailable(template?: DataCollectionTemplate | null) {
    if (
      !template ||
      template.deletedAt ||
      template.status === TemplateStatus.ARCHIVED ||
      !template.isActive
    ) {
      throw new BadRequestException('This form is no longer available');
    }
  }

  private resolveFormName(template?: DataCollectionTemplate | null): string | null {
    if (!template) return null;
    const name = String(template.name || '').trim();
    const schemaName =
      template.schema && typeof (template.schema as any).formName === 'string'
        ? String((template.schema as any).formName).trim()
        : '';
    return name || schemaName || null;
  }

  private async loadUserNamesByIds(
    req: any,
    userIds: number[],
  ): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const uniqueIds = [...new Set(userIds.filter((id) => Number.isFinite(id)))];
    if (!uniqueIds.length) return map;

    const userRepo = req.tenantConnection.getRepository(User);
    const users: User[] = await userRepo.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'name'],
    });
    for (const user of users) {
      map.set(user.id, (user.name || '').trim() || `User #${user.id}`);
    }
    return map;
  }

  /**
   * Enrich a submission with the full template payload for review UIs.
   * Prefers the pinned version schemaSnapshot so historical answers match the form layout.
   * Also includes assignment `mode` and employee-facing `completion` (shared vs individual).
   */
  private serializeSubmissionResponse(
    submission: DataCollectionSubmission,
    template?: DataCollectionTemplate | null,
    version?: TemplateVersion | null,
    assignment?: DataCollectionAssignment | null,
    options?: {
      viewerUserId?: number | null;
      completedByName?: string | null;
    },
  ) {
    const schema = (version?.schemaSnapshot ?? template?.schema ?? null) as Record<
      string,
      any
    > | null;
    const templatePayload = template
      ? {
          id: template.id,
          name: template.name,
          schema,
          status: template.status,
          isActive: template.isActive,
          createdBy: template.createdBy,
          updatedBy: template.updatedBy,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          deletedAt: template.deletedAt,
        }
      : null;
    const formName = this.resolveFormName(
      templatePayload
        ? ({ name: templatePayload.name, schema: templatePayload.schema } as DataCollectionTemplate)
        : null,
    );

    const mode = assignment?.assignmentType || AssignmentType.INDIVIDUAL;
    const completedByUserId =
      assignment?.completedByUserId ?? submission.submittedBy ?? null;
    const completedAt =
      assignment?.completedAt || submission.submittedAt || null;
    const completion = assignment
      ? buildAssignmentCompletion({
          status: assignment.status,
          assignmentType: mode,
          completedByUserId,
          completedAt,
          completedByName: options?.completedByName ?? null,
          viewerUserId: options?.viewerUserId ?? null,
        })
      : null;

    return {
      id: submission.id,
      assignmentId: submission.assignmentId,
      templateVersionId: submission.templateVersionId,
      submittedBy: submission.submittedBy,
      answers: submission.answers || {},
      response: submission.answers || {},
      status: submission.status,
      submittedAt: submission.submittedAt,
      reviewedBy: submission.reviewedById ?? null,
      reviewedAt: submission.reviewedAt ?? null,
      reviewNote: submission.reviewNote ?? null,
      createdBy: submission.createdBy,
      updatedBy: submission.updatedBy,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
      deletedAt: submission.deletedAt,
      templateId: template?.id ?? version?.templateId ?? null,
      templateName: formName,
      formName,
      template: templatePayload,
      mode,
      completion,
    };
  }

  private async countUnresolvedFlags(req: any, submissionId: number): Promise<number> {
    const flagRepo = req.tenantConnection.getRepository(DataCollectionSubmissionFlag);
    return flagRepo.count({ where: { submissionId, isResolved: false } });
  }

  private async recordReviewEvent(
    manager: any,
    params: {
      submissionId: number;
      action: SubmissionReviewAction;
      note?: string | null;
      performedById: number;
    },
  ) {
    const eventRepo = manager.getRepository(DataCollectionSubmissionReviewEvent);
    const event = eventRepo.create({
      submissionId: params.submissionId,
      action: params.action,
      note: params.note ?? null,
      performedById: params.performedById,
    });
    await eventRepo.save(event);
  }

  private assertHasReviewPermission(req: any) {
    const permissions =
      req.user?.permissions ||
      req.user?.role?.permissions?.map((p: any) =>
        typeof p === 'string' ? p : p.name,
      ) ||
      [];
    if (!permissions.includes(DC_PERM_REVIEW_SUBMISSION)) {
      throw new ForbiddenException(
        `Missing required permission: ${DC_PERM_REVIEW_SUBMISSION}`,
      );
    }
  }

  private async loadTemplateContext(
    req: any,
    submissions: DataCollectionSubmission[],
  ): Promise<{
    templatesById: Map<number, DataCollectionTemplate>;
    versionsById: Map<number, TemplateVersion>;
    assignmentsById: Map<number, DataCollectionAssignment>;
  }> {
    const templatesById = new Map<number, DataCollectionTemplate>();
    const versionsById = new Map<number, TemplateVersion>();
    const assignmentsById = new Map<number, DataCollectionAssignment>();

    if (!submissions.length) {
      return { templatesById, versionsById, assignmentsById };
    }

    const assignmentIds = [
      ...new Set(submissions.map((s) => s.assignmentId).filter((id) => Number.isFinite(id))),
    ];
    const versionIds = [
      ...new Set(submissions.map((s) => s.templateVersionId).filter((id) => Number.isFinite(id))),
    ];

    const assignmentRepo = req.tenantConnection.getRepository(DataCollectionAssignment);
    const versionRepo = req.tenantConnection.getRepository(TemplateVersion);
    const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);

    const assignments: DataCollectionAssignment[] = assignmentIds.length
      ? await assignmentRepo.find({ where: { id: In(assignmentIds) } })
      : [];
    for (const assignment of assignments) {
      assignmentsById.set(assignment.id, assignment);
    }

    const templateIds = [
      ...new Set(
        assignments.map((a) => a.templateId).filter((id) => Number.isFinite(id)),
      ),
    ];

    const [templates, versions] = await Promise.all([
      templateIds.length
        ? templateRepo.find({ where: { id: In(templateIds) } })
        : Promise.resolve([] as DataCollectionTemplate[]),
      versionIds.length
        ? versionRepo.find({ where: { id: In(versionIds) } })
        : Promise.resolve([] as TemplateVersion[]),
    ]);

    for (const template of templates) templatesById.set(template.id, template);
    for (const version of versions) versionsById.set(version.id, version);

    return { templatesById, versionsById, assignmentsById };
  }

  private async enrichSubmissions(req: any, submissions: DataCollectionSubmission[]) {
    const { templatesById, versionsById, assignmentsById } =
      await this.loadTemplateContext(req, submissions);
    const viewerUserId = this.getActorId(req);

    const completedByIds = submissions
      .map((submission) => {
        const assignment = assignmentsById.get(submission.assignmentId);
        return assignment?.completedByUserId ?? submission.submittedBy ?? null;
      })
      .filter((id): id is number => id != null && Number.isFinite(id));

    const namesById = await this.loadUserNamesByIds(req, completedByIds);

    return submissions.map((submission) => {
      const assignment = assignmentsById.get(submission.assignmentId) || null;
      const templateId = assignment?.templateId;
      const template = templateId != null ? templatesById.get(templateId) || null : null;
      const version = versionsById.get(submission.templateVersionId) || null;
      const completedByUserId =
        assignment?.completedByUserId ?? submission.submittedBy ?? null;
      return this.serializeSubmissionResponse(submission, template, version, assignment, {
        viewerUserId,
        completedByName:
          completedByUserId != null ? namesById.get(completedByUserId) || null : null,
      });
    });
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

  /**
   * Ensure the assignment is in progress when the employee is actively filling it.
   * Keeps overdue as overdue (still open work).
   */
  private async markAssignmentInProgressIfOpen(
    assignmentRepo: any,
    assignment: DataCollectionAssignment,
    actorId: number | null,
  ) {
    if (
      assignment.status === AssignmentStatus.PENDING ||
      assignment.status === AssignmentStatus.IN_PROGRESS
    ) {
      if (assignment.status !== AssignmentStatus.IN_PROGRESS) {
        assignment.status = AssignmentStatus.IN_PROGRESS;
        assignment.updatedBy = actorId;
        await assignmentRepo.save(assignment);
      }
    }
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

      const templateForGate = await templateRepo.findOne({ where: { id: assignment.templateId } });
      this.assertTemplateAvailable(templateForGate);

      await this.assertSharedGroupOpen(assignmentRepo, assignment);

      const version = await versionRepo.findOne({ where: { id: assignment.templateVersionId } });
      if (!version) throw new NotFoundException('Template version for assignment not found');

      const existingFinalized = await submissionRepo.findOne({
        where: {
          assignmentId,
          status: In([
            SubmissionStatus.SUBMITTED,
            SubmissionStatus.FLAGGED,
            SubmissionStatus.FAILED,
            SubmissionStatus.APPROVED,
          ]),
        },
      });
      if (existingFinalized) {
        throw new BadRequestException('A submission already exists for this assignment');
      }

      const shouldSubmit = dto.submit !== false;
      const actorId = this.getActorId(req);
      const incomingAnswers = dto.answers;

      // Resume support: one draft per assignment — update it instead of creating duplicates.
      const existingDraft = (
        await submissionRepo.find({
          where: { assignmentId, status: SubmissionStatus.DRAFT },
          order: { updatedAt: 'DESC' },
          take: 1,
        })
      )[0];

      const mergedAnswers =
        incomingAnswers !== undefined
          ? incomingAnswers
          : existingDraft?.answers || {};

      this.validateAnswers(version.schemaSnapshot, mergedAnswers || {}, shouldSubmit);

      let saved: DataCollectionSubmission;

      if (existingDraft) {
        if (incomingAnswers !== undefined) {
          existingDraft.answers = incomingAnswers;
        }
        existingDraft.updatedBy = actorId;
        if (shouldSubmit) {
          const unresolved = await this.countUnresolvedFlags(req, existingDraft.id);
          const nextStatus = resolveSubmitStatus(unresolved > 0);
          assertSubmissionStatusTransition(existingDraft.status, nextStatus);
          existingDraft.status = nextStatus;
          existingDraft.submittedAt = new Date();
          existingDraft.submittedBy = actorId;
        }
        saved = await submissionRepo.save(existingDraft);
      } else {
        // New row: flags cannot exist yet, so finalize as submitted (or draft).
        const submission = submissionRepo.create({
          assignmentId,
          templateVersionId: version.id,
          submittedBy: actorId,
          answers: mergedAnswers || {},
          status: shouldSubmit ? SubmissionStatus.SUBMITTED : SubmissionStatus.DRAFT,
          submittedAt: shouldSubmit ? new Date() : null,
          createdBy: actorId,
          updatedBy: actorId,
        });
        saved = await submissionRepo.save(submission);
      }

      let workflowResult: Awaited<ReturnType<WorkflowActionsService['runAfterSubmit']>> | undefined;
      if (shouldSubmit) {
        const completedAt = saved.submittedAt || new Date();
        await this.markAssignmentCompleted(assignmentRepo, assignment, actorId, completedAt);

        if (saved.status === SubmissionStatus.FLAGGED && actorId != null) {
          await this.recordReviewEvent(req.tenantConnection.manager, {
            submissionId: saved.id,
            action: SubmissionReviewAction.FLAGGED,
            note: 'Submitted with unresolved flags',
            performedById: actorId,
          });
        }

        const template = await templateRepo.findOne({ where: { id: assignment.templateId } });
        workflowResult = await this.workflowActions.runAfterSubmit(req, {
          templateId: assignment.templateId,
          templateName: template?.name || '',
          assignmentId: assignment.id,
          submissionId: saved.id,
          schema: (version.schemaSnapshot || template?.schema || {}) as Record<string, any>,
          submittedBy: actorId,
        });
      } else {
        await this.markAssignmentInProgressIfOpen(assignmentRepo, assignment, actorId);
      }

      // Enrich after completion so `mode` / `completion` reflect the final assignment state.
      const [data] = await this.enrichSubmissions(req, [saved]);

      return {
        success: true,
        message: shouldSubmit ? 'Submission saved' : 'Draft submission saved',
        data,
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

      if (isFinalizedSubmissionStatus(submission.status) && dto.submit !== false) {
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
        const templateForGate = await templateRepo.findOne({ where: { id: assignment.templateId } });
        this.assertTemplateAvailable(templateForGate);
        await this.assertSharedGroupOpen(assignmentRepo, assignment);
        this.validateAnswers(version.schemaSnapshot, submission.answers || {}, true);
        const unresolved = await this.countUnresolvedFlags(req, submission.id);
        const nextStatus = resolveSubmitStatus(unresolved > 0);
        assertSubmissionStatusTransition(submission.status, nextStatus);
        submission.status = nextStatus;
        submission.submittedAt = new Date();
        submission.submittedBy = actorId;
      }

      submission.updatedBy = actorId;
      const saved = await submissionRepo.save(submission);

      let workflowResult: Awaited<ReturnType<WorkflowActionsService['runAfterSubmit']>> | undefined;
      if (shouldSubmit && assignment) {
        const completedAt = saved.submittedAt || new Date();
        await this.markAssignmentCompleted(assignmentRepo, assignment, actorId, completedAt);

        if (saved.status === SubmissionStatus.FLAGGED && actorId != null) {
          await this.recordReviewEvent(req.tenantConnection.manager, {
            submissionId: saved.id,
            action: SubmissionReviewAction.FLAGGED,
            note: 'Submitted with unresolved flags',
            performedById: actorId,
          });
        }

        const template = await templateRepo.findOne({ where: { id: assignment.templateId } });
        workflowResult = await this.workflowActions.runAfterSubmit(req, {
          templateId: assignment.templateId,
          templateName: template?.name || '',
          assignmentId: assignment.id,
          submissionId: saved.id,
          schema: (version.schemaSnapshot || template?.schema || {}) as Record<string, any>,
          submittedBy: actorId,
        });
      } else if (!shouldSubmit) {
        const openAssignment =
          assignment ||
          (await assignmentRepo.findOne({ where: { id: submission.assignmentId } }));
        if (openAssignment) {
          await this.markAssignmentInProgressIfOpen(assignmentRepo, openAssignment, actorId);
        }
      }

      // Enrich after completion so `mode` / `completion` reflect the final assignment state.
      const [data] = await this.enrichSubmissions(req, [saved]);

      return {
        success: true,
        message: shouldSubmit ? 'Submission submitted' : 'Submission updated',
        data,
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
      const [rows, total] = await qb.getManyAndCount();
      const lastPage = Math.ceil(total / limit) || 1;
      const data = await this.enrichSubmissions(req, rows);

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
      const [data] = await this.enrichSubmissions(req, [submission]);
      return { success: true, data };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve submission');
    }
  }

  async approve(req: any, id: number) {
    try {
      this.assertHasReviewPermission(req);
      const actorId = this.getActorId(req);
      if (actorId == null) {
        throw new ForbiddenException('User not authenticated for tenant context');
      }

      const saved = await req.tenantConnection.manager.transaction(async (manager) => {
        const submissionRepo = manager.getRepository(DataCollectionSubmission);
        const flagRepo = manager.getRepository(DataCollectionSubmissionFlag);

        const submission = await submissionRepo.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!submission) {
          throw new NotFoundException(`Submission with ID ${id} not found`);
        }

        assertSubmissionStatusTransition(submission.status, SubmissionStatus.APPROVED);

        const unresolved = await flagRepo.count({
          where: { submissionId: submission.id, isResolved: false },
        });
        if (unresolved > 0) {
          throw new BadRequestException(
            'Cannot approve a submission with unresolved flags.',
          );
        }

        submission.status = SubmissionStatus.APPROVED;
        submission.reviewedById = actorId;
        submission.reviewedAt = new Date();
        submission.updatedBy = actorId;
        const updated = await submissionRepo.save(submission);

        await this.recordReviewEvent(manager, {
          submissionId: updated.id,
          action: SubmissionReviewAction.APPROVED,
          note: null,
          performedById: actorId,
        });

        return updated;
      });

      const [data] = await this.enrichSubmissions(req, [saved]);
      return { success: true, message: 'Submission approved', data };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      console.error('Submission approve failed:', error);
      throw new InternalServerErrorException('Failed to approve submission');
    }
  }

  async fail(req: any, id: number, dto: FailSubmissionDto) {
    try {
      this.assertHasReviewPermission(req);
      const actorId = this.getActorId(req);
      if (actorId == null) {
        throw new ForbiddenException('User not authenticated for tenant context');
      }

      const note = String(dto.note || '').trim();
      if (!note) {
        throw new BadRequestException('note is required');
      }

      const saved = await req.tenantConnection.manager.transaction(async (manager) => {
        const submissionRepo = manager.getRepository(DataCollectionSubmission);

        const submission = await submissionRepo.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!submission) {
          throw new NotFoundException(`Submission with ID ${id} not found`);
        }

        assertSubmissionStatusTransition(submission.status, SubmissionStatus.FAILED);

        submission.status = SubmissionStatus.FAILED;
        submission.reviewedById = actorId;
        submission.reviewedAt = new Date();
        submission.reviewNote = note;
        submission.updatedBy = actorId;
        const updated = await submissionRepo.save(submission);

        await this.recordReviewEvent(manager, {
          submissionId: updated.id,
          action: SubmissionReviewAction.FAILED,
          note,
          performedById: actorId,
        });

        return updated;
      });

      const [data] = await this.enrichSubmissions(req, [saved]);
      return { success: true, message: 'Submission failed', data };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      console.error('Submission fail failed:', error);
      throw new InternalServerErrorException('Failed to fail submission');
    }
  }
}
