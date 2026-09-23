import { BadRequestException } from '@nestjs/common';
import { SubmissionStatus } from '../entities/enums';

/** Statuses that mean the employee has finished submitting (assignment is done). */
export const FINALIZED_SUBMISSION_STATUSES: SubmissionStatus[] = [
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.FLAGGED,
  SubmissionStatus.FAILED,
  SubmissionStatus.APPROVED,
];

const ALLOWED_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  [SubmissionStatus.DRAFT]: [SubmissionStatus.SUBMITTED, SubmissionStatus.FLAGGED],
  [SubmissionStatus.SUBMITTED]: [
    SubmissionStatus.FLAGGED,
    SubmissionStatus.APPROVED,
    SubmissionStatus.FAILED,
  ],
  [SubmissionStatus.FLAGGED]: [SubmissionStatus.APPROVED, SubmissionStatus.FAILED],
  [SubmissionStatus.APPROVED]: [],
  [SubmissionStatus.FAILED]: [],
};

export function isFinalizedSubmissionStatus(status: SubmissionStatus): boolean {
  return FINALIZED_SUBMISSION_STATUSES.includes(status);
}

export function assertSubmissionStatusTransition(
  from: SubmissionStatus,
  to: SubmissionStatus,
): void {
  if (from === to) return;
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(
      `Invalid submission status transition: ${from} → ${to}`,
    );
  }
}

/**
 * Final employee submit: draft → submitted when no open flags, otherwise flagged.
 */
export function resolveSubmitStatus(hasUnresolvedFlags: boolean): SubmissionStatus {
  return hasUnresolvedFlags ? SubmissionStatus.FLAGGED : SubmissionStatus.SUBMITTED;
}
