import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import {
  DC_PERM_COMPLETE_ASSIGNMENT,
  DC_PERM_REVIEW_SUBMISSION,
} from '../config/data-collection.constants';
import {
  AssignmentType,
  DataCollectionAssignment,
  DataCollectionSubmission,
  DataCollectionSubmissionFlag,
  DataCollectionSubmissionReviewEvent,
  FlagSeverity,
  SubmissionReviewAction,
  SubmissionStatus,
  TemplateVersion,
} from '../entities';
import {
  CreateSubmissionFlagDto,
  ResolveSubmissionFlagDto,
  UpdateSubmissionFlagDto,
} from '../dto/submissions/submission-flag.dto';
import { User } from '../../users/entities';
import { assertSubmissionStatusTransition } from '../utils/submission-status.util';

@Injectable()
export class SubmissionFlagsService {
  private getActorId(req: any): number | null {
    const candidate = req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) return null;
    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  private getUserPermissions(req: any): string[] {
    const user = req.user;
    if (!user) return [];
    return (
      user.permissions ||
      user.role?.permissions?.map((p: any) => (typeof p === 'string' ? p : p.name)) ||
      []
    );
  }

  private hasPermission(req: any, permission: string): boolean {
    return this.getUserPermissions(req).includes(permission);
  }

  private hasReviewPermission(req: any): boolean {
    return this.hasPermission(req, DC_PERM_REVIEW_SUBMISSION);
  }

  private hasCompletePermission(req: any): boolean {
    return this.hasPermission(req, DC_PERM_COMPLETE_ASSIGNMENT);
  }

  private collectFieldIds(schema: Record<string, any> | null): Set<string> {
    const ids = new Set<string>();
    const sections = Array.isArray(schema?.sections) ? schema.sections : [];
    for (const section of sections) {
      for (const row of section.rows || []) {
        for (const field of row.fields || []) {
          if (field?.id != null && String(field.id).trim() !== '') {
            ids.add(String(field.id));
          }
        }
      }
    }
    return ids;
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

  private serializeFlag(
    flag: DataCollectionSubmissionFlag,
    namesById: Map<number, string>,
  ) {
    return {
      id: flag.id,
      submissionId: flag.submissionId,
      fieldId: flag.fieldId,
      reason: flag.reason,
      severity: flag.severity,
      isResolved: flag.isResolved,
      createdBy: {
        id: flag.createdById,
        name: namesById.get(flag.createdById) || `User #${flag.createdById}`,
      },
      createdAt: flag.createdAt,
      resolvedBy:
        flag.resolvedById != null
          ? {
              id: flag.resolvedById,
              name:
                namesById.get(flag.resolvedById) || `User #${flag.resolvedById}`,
            }
          : null,
      resolvedAt: flag.resolvedAt,
      resolutionNote: flag.resolutionNote,
    };
  }

  /**
   * Employee may access via their assignment (or shared group). Reviewers may access any.
   */
  async assertCanAccessSubmission(
    req: any,
    submission: DataCollectionSubmission,
    options?: { requireReview?: boolean },
  ): Promise<DataCollectionAssignment> {
    const actorId = this.getActorId(req);
    if (actorId == null) {
      throw new ForbiddenException('User not authenticated for tenant context');
    }

    const assignmentRepo = req.tenantConnection.getRepository(DataCollectionAssignment);
    const assignment = await assignmentRepo.findOne({
      where: { id: submission.assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException(
        `Assignment with ID ${submission.assignmentId} not found`,
      );
    }

    if (options?.requireReview) {
      if (!this.hasReviewPermission(req)) {
        throw new ForbiddenException(
          `Missing required permission: ${DC_PERM_REVIEW_SUBMISSION}`,
        );
      }
      return assignment;
    }

    if (this.hasReviewPermission(req)) {
      return assignment;
    }

    if (!this.hasCompletePermission(req)) {
      throw new ForbiddenException(
        `Missing required permission: ${DC_PERM_COMPLETE_ASSIGNMENT} or ${DC_PERM_REVIEW_SUBMISSION}`,
      );
    }

    const isDirectAssignee = assignment.assigneeUserId === actorId;
    if (isDirectAssignee) return assignment;

    if (
      assignment.assignmentType === AssignmentType.SHARED &&
      assignment.sharedGroupKey
    ) {
      const peer = await assignmentRepo.findOne({
        where: {
          sharedGroupKey: assignment.sharedGroupKey,
          assigneeUserId: actorId,
        },
      });
      if (peer) return assignment;
    }

    throw new ForbiddenException('You are not authorized to access this submission');
  }

  private async countUnresolvedFlags(
    managerOrRepo: any,
    submissionId: number,
  ): Promise<number> {
    const flagRepo =
      typeof managerOrRepo.getRepository === 'function'
        ? managerOrRepo.getRepository(DataCollectionSubmissionFlag)
        : managerOrRepo;
    return flagRepo.count({
      where: { submissionId, isResolved: false },
    });
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

  private async loadSubmissionOrFail(
    req: any,
    submissionId: number,
  ): Promise<DataCollectionSubmission> {
    const submissionRepo = req.tenantConnection.getRepository(DataCollectionSubmission);
    const submission = await submissionRepo.findOne({ where: { id: submissionId } });
    if (!submission) {
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }
    return submission;
  }

  private assertCanFlagStatus(status: SubmissionStatus) {
    if (
      status === SubmissionStatus.APPROVED ||
      status === SubmissionStatus.FAILED
    ) {
      throw new BadRequestException(
        `Cannot add flags to a ${status} submission`,
      );
    }
  }

  async create(req: any, submissionId: number, dto: CreateSubmissionFlagDto) {
    try {
      const actorId = this.getActorId(req);
      if (actorId == null) {
        throw new ForbiddenException('User not authenticated for tenant context');
      }

      return await req.tenantConnection.manager.transaction(async (manager) => {
        const submissionRepo = manager.getRepository(DataCollectionSubmission);
        const flagRepo = manager.getRepository(DataCollectionSubmissionFlag);
        const versionRepo = manager.getRepository(TemplateVersion);

        const submission = await submissionRepo.findOne({
          where: { id: submissionId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!submission) {
          throw new NotFoundException(`Submission with ID ${submissionId} not found`);
        }

        await this.assertCanAccessSubmission(req, submission);
        this.assertCanFlagStatus(submission.status);

        const fieldId =
          dto.fieldId === undefined || dto.fieldId === null || dto.fieldId === ''
            ? null
            : String(dto.fieldId);

        if (fieldId != null) {
          const version = await versionRepo.findOne({
            where: { id: submission.templateVersionId },
          });
          if (!version) {
            throw new NotFoundException('Template version for submission not found');
          }
          const fieldIds = this.collectFieldIds(
            (version.schemaSnapshot || null) as Record<string, any> | null,
          );
          if (!fieldIds.has(fieldId)) {
            throw new BadRequestException(
              `Field "${fieldId}" does not exist on the pinned template version`,
            );
          }
        }

        const flag = flagRepo.create({
          submissionId: submission.id,
          fieldId,
          reason: dto.reason.trim(),
          severity: dto.severity ?? FlagSeverity.MEDIUM,
          createdById: actorId,
          isResolved: false,
          resolvedById: null,
          resolvedAt: null,
          resolutionNote: null,
        });
        const savedFlag = await flagRepo.save(flag);

        // submitted → flagged when a manager/employee adds a flag after submit
        if (submission.status === SubmissionStatus.SUBMITTED) {
          assertSubmissionStatusTransition(
            submission.status,
            SubmissionStatus.FLAGGED,
          );
          submission.status = SubmissionStatus.FLAGGED;
          submission.updatedBy = actorId;
          await submissionRepo.save(submission);

          await this.recordReviewEvent(manager, {
            submissionId: submission.id,
            action: SubmissionReviewAction.FLAGGED,
            note: savedFlag.reason,
            performedById: actorId,
          });
        } else if (submission.status === SubmissionStatus.FLAGGED) {
          await this.recordReviewEvent(manager, {
            submissionId: submission.id,
            action: SubmissionReviewAction.FLAGGED,
            note: savedFlag.reason,
            performedById: actorId,
          });
        }

        const namesById = await this.loadUserNamesByIds(req, [actorId]);
        return {
          success: true,
          message: 'Flag created',
          data: this.serializeFlag(savedFlag, namesById),
        };
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      console.error('Submission flag create failed:', error);
      throw new InternalServerErrorException('Failed to create submission flag');
    }
  }

  async findBySubmission(req: any, submissionId: number) {
    try {
      const submission = await this.loadSubmissionOrFail(req, submissionId);
      await this.assertCanAccessSubmission(req, submission);

      const flagRepo = req.tenantConnection.getRepository(DataCollectionSubmissionFlag);
      const flags: DataCollectionSubmissionFlag[] = await flagRepo.find({
        where: { submissionId },
        order: { createdAt: 'ASC', id: 'ASC' },
      });

      const userIds = flags.flatMap((f) =>
        [f.createdById, f.resolvedById].filter(
          (id): id is number => id != null && Number.isFinite(id),
        ),
      );
      const namesById = await this.loadUserNamesByIds(req, userIds);

      return {
        success: true,
        data: flags.map((flag) => this.serializeFlag(flag, namesById)),
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to list submission flags');
    }
  }

  async resolve(
    req: any,
    submissionId: number,
    flagId: number,
    dto: ResolveSubmissionFlagDto,
  ) {
    try {
      const actorId = this.getActorId(req);
      if (actorId == null) {
        throw new ForbiddenException('User not authenticated for tenant context');
      }
      if (!this.hasReviewPermission(req)) {
        throw new ForbiddenException(
          `Missing required permission: ${DC_PERM_REVIEW_SUBMISSION}`,
        );
      }

      return await req.tenantConnection.manager.transaction(async (manager) => {
        const submissionRepo = manager.getRepository(DataCollectionSubmission);
        const flagRepo = manager.getRepository(DataCollectionSubmissionFlag);

        const submission = await submissionRepo.findOne({
          where: { id: submissionId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!submission) {
          throw new NotFoundException(`Submission with ID ${submissionId} not found`);
        }
        await this.assertCanAccessSubmission(req, submission, { requireReview: true });

        const flag = await flagRepo.findOne({
          where: { id: flagId, submissionId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!flag) {
          throw new NotFoundException(
            `Flag with ID ${flagId} not found on submission ${submissionId}`,
          );
        }
        if (flag.isResolved) {
          throw new BadRequestException('Flag is already resolved');
        }

        flag.isResolved = true;
        flag.resolvedById = actorId;
        flag.resolvedAt = new Date();
        flag.resolutionNote =
          dto.resolutionNote != null ? String(dto.resolutionNote).trim() || null : null;
        const saved = await flagRepo.save(flag);

        // Resolving the last flag must NOT auto-approve — stay flagged / current status.
        await this.recordReviewEvent(manager, {
          submissionId: submission.id,
          action: SubmissionReviewAction.FLAG_RESOLVED,
          note: saved.resolutionNote,
          performedById: actorId,
        });

        const namesById = await this.loadUserNamesByIds(req, [
          saved.createdById,
          actorId,
        ]);
        return {
          success: true,
          message: 'Flag resolved',
          data: this.serializeFlag(saved, namesById),
        };
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      console.error('Submission flag resolve failed:', error);
      throw new InternalServerErrorException('Failed to resolve submission flag');
    }
  }

  async update(
    req: any,
    submissionId: number,
    flagId: number,
    dto: UpdateSubmissionFlagDto,
  ) {
    try {
      const actorId = this.getActorId(req);
      if (actorId == null) {
        throw new ForbiddenException('User not authenticated for tenant context');
      }

      const submission = await this.loadSubmissionOrFail(req, submissionId);
      await this.assertCanAccessSubmission(req, submission);

      const flagRepo = req.tenantConnection.getRepository(DataCollectionSubmissionFlag);
      const flag = await flagRepo.findOne({ where: { id: flagId, submissionId } });
      if (!flag) {
        throw new NotFoundException(
          `Flag with ID ${flagId} not found on submission ${submissionId}`,
        );
      }

      if (flag.isResolved) {
        throw new BadRequestException('Cannot modify a resolved flag');
      }

      const isReviewer = this.hasReviewPermission(req);
      if (!isReviewer && flag.createdById !== actorId) {
        throw new ForbiddenException('You can only edit flags you created');
      }

      if (dto.reason !== undefined) {
        const trimmed = String(dto.reason).trim();
        if (!trimmed) throw new BadRequestException('reason must not be empty');
        flag.reason = trimmed;
      }
      if (dto.severity !== undefined) {
        flag.severity = dto.severity;
      }

      const saved = await flagRepo.save(flag);
      const namesById = await this.loadUserNamesByIds(req, [
        saved.createdById,
        saved.resolvedById,
      ].filter((id): id is number => id != null));

      return {
        success: true,
        message: 'Flag updated',
        data: this.serializeFlag(saved, namesById),
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update submission flag');
    }
  }

  /** Used by SubmissionsService on finalize. */
  async countUnresolvedForSubmission(req: any, submissionId: number): Promise<number> {
    return this.countUnresolvedFlags(req.tenantConnection, submissionId);
  }
}
