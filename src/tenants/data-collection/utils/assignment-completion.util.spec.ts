import {
  AssignmentCompletionState,
  AssignmentStatus,
  AssignmentType,
} from '../entities/enums';
import {
  buildAssignmentCompletion,
  formatAssignmentCompletedAt,
  normalizeIdList,
  resolveAssignReportMode,
  resolveAssignmentType,
} from './assignment-completion.util';

describe('assignment-completion.util', () => {
  const completedAt = new Date('2026-09-15T14:10:00.000Z');

  it('defaults unknown types to individual', () => {
    expect(resolveAssignmentType(undefined)).toBe(AssignmentType.INDIVIDUAL);
    expect(resolveAssignmentType('shared')).toBe(AssignmentType.SHARED);
    expect(resolveAssignReportMode({ mode: 'shared' })).toBe(AssignmentType.SHARED);
    expect(resolveAssignReportMode({ mode: 'individual' })).toBe(AssignmentType.INDIVIDUAL);
    expect(resolveAssignReportMode({ assignmentType: 'shared' })).toBe(AssignmentType.SHARED);
    expect(resolveAssignReportMode({ mode: 'individual', assignmentType: 'shared' })).toBe(
      AssignmentType.INDIVIDUAL,
    );
    expect(normalizeIdList(null)).toEqual([]);
    expect(normalizeIdList([4, '5', 'x'])).toEqual([4, 5]);
  });

  it('formats completed-at for employee copy', () => {
    const formatted = formatAssignmentCompletedAt(completedAt);
    expect(formatted).toMatch(/September 15, 2026 at /);
    expect(formatted).toMatch(/PM|AM/);
  });

  it('returns null when assignment is not completed', () => {
    expect(
      buildAssignmentCompletion({
        status: AssignmentStatus.PENDING,
        assignmentType: AssignmentType.SHARED,
        completedByUserId: 1,
        completedAt,
        viewerUserId: 2,
      }),
    ).toBeNull();
  });

  it('shows Completed by another user for shared non-submitters', () => {
    const completion = buildAssignmentCompletion({
      status: AssignmentStatus.COMPLETED,
      assignmentType: AssignmentType.SHARED,
      completedByUserId: 7,
      completedByName: 'Ahmed',
      completedAt,
      viewerUserId: 3,
    });

    expect(completion).toEqual(
      expect.objectContaining({
        state: AssignmentCompletionState.COMPLETED_BY_OTHER,
        title: 'Completed by another user',
        completedByUserId: 7,
        completedByName: 'Ahmed',
      }),
    );
    expect(completion?.message).toContain('completed by Ahmed on');
  });

  it('shows Completed for the shared submitter', () => {
    const completion = buildAssignmentCompletion({
      status: AssignmentStatus.COMPLETED,
      assignmentType: AssignmentType.SHARED,
      completedByUserId: 7,
      completedByName: 'Ahmed',
      completedAt,
      viewerUserId: 7,
    });

    expect(completion).toEqual(
      expect.objectContaining({
        state: AssignmentCompletionState.COMPLETED_BY_ME,
        title: 'Completed',
      }),
    );
    expect(completion?.message).toContain('You submitted this shared task on');
  });

  it('keeps a simple Completed state for individual assignments', () => {
    const completion = buildAssignmentCompletion({
      status: AssignmentStatus.COMPLETED,
      assignmentType: AssignmentType.INDIVIDUAL,
      completedByUserId: 7,
      completedAt,
      viewerUserId: 7,
    });

    expect(completion?.state).toBe(AssignmentCompletionState.COMPLETED);
    expect(completion?.title).toBe('Completed');
  });
});
