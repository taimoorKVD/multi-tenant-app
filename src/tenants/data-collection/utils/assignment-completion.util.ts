import { AssignmentCompletionState, AssignmentStatus, AssignmentType } from '../entities/enums';

export type AssignmentCompletionPayload = {
  state: AssignmentCompletionState;
  title: string;
  message: string;
  completedByUserId: number | null;
  completedByName: string | null;
  completedAt: Date | string | null;
};

/** Formats timestamps for employee-facing completion copy. */
export function formatAssignmentCompletedAt(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const datePart = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${datePart} at ${timePart}`;
}

export function buildAssignmentCompletion(params: {
  status: AssignmentStatus;
  assignmentType: AssignmentType | string | null | undefined;
  completedByUserId: number | null | undefined;
  completedAt: Date | string | null | undefined;
  completedByName?: string | null;
  viewerUserId?: number | null;
}): AssignmentCompletionPayload | null {
  if (params.status !== AssignmentStatus.COMPLETED) return null;

  const completedAt = params.completedAt ?? null;
  const when = formatAssignmentCompletedAt(completedAt);
  const completedByUserId =
    params.completedByUserId != null && Number.isFinite(Number(params.completedByUserId))
      ? Number(params.completedByUserId)
      : null;
  const completedByName = (params.completedByName || '').trim() || null;
  const displayName = completedByName || (completedByUserId != null ? `User #${completedByUserId}` : 'another user');
  const isShared = params.assignmentType === AssignmentType.SHARED;
  const viewerId =
    params.viewerUserId != null && Number.isFinite(Number(params.viewerUserId))
      ? Number(params.viewerUserId)
      : null;
  const completedByViewer =
    viewerId != null && completedByUserId != null && viewerId === completedByUserId;

  if (isShared && completedByUserId != null && !completedByViewer) {
    return {
      state: AssignmentCompletionState.COMPLETED_BY_OTHER,
      title: 'Completed by another user',
      message: when
        ? `This shared task was completed by ${displayName} on ${when}.`
        : `This shared task was completed by ${displayName}.`,
      completedByUserId,
      completedByName,
      completedAt,
    };
  }

  if (isShared && completedByViewer) {
    return {
      state: AssignmentCompletionState.COMPLETED_BY_ME,
      title: 'Completed',
      message: when
        ? `You submitted this shared task on ${when}.`
        : 'You submitted this shared task.',
      completedByUserId,
      completedByName,
      completedAt,
    };
  }

  return {
    state: AssignmentCompletionState.COMPLETED,
    title: 'Completed',
    message: when ? `Completed on ${when}.` : 'Completed.',
    completedByUserId,
    completedByName,
    completedAt,
  };
}

export function resolveAssignmentType(raw: unknown): AssignmentType {
  return raw === AssignmentType.SHARED ? AssignmentType.SHARED : AssignmentType.INDIVIDUAL;
}

/**
 * Resolve individual|shared from assign/report targets.
 * Prefers frontend `mode`; falls back to legacy `assignmentType`.
 */
export function resolveAssignReportMode(
  target: { mode?: unknown; assignmentType?: unknown } | null | undefined,
): AssignmentType {
  return resolveAssignmentType(target?.mode ?? target?.assignmentType);
}

/** Normalize users / jobPosition arrays when frontend sends null. */
export function normalizeIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter(Number.isFinite);
}
