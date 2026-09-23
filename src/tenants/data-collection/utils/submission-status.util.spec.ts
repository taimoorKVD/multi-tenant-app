import {
  assertSubmissionStatusTransition,
  isFinalizedSubmissionStatus,
  resolveSubmitStatus,
} from './submission-status.util';
import { SubmissionStatus } from '../entities/enums';

describe('submission-status.util', () => {
  it('resolveSubmitStatus maps open flags to flagged', () => {
    expect(resolveSubmitStatus(false)).toBe(SubmissionStatus.SUBMITTED);
    expect(resolveSubmitStatus(true)).toBe(SubmissionStatus.FLAGGED);
  });

  it('treats review statuses as finalized', () => {
    expect(isFinalizedSubmissionStatus(SubmissionStatus.DRAFT)).toBe(false);
    expect(isFinalizedSubmissionStatus(SubmissionStatus.SUBMITTED)).toBe(true);
    expect(isFinalizedSubmissionStatus(SubmissionStatus.FLAGGED)).toBe(true);
    expect(isFinalizedSubmissionStatus(SubmissionStatus.FAILED)).toBe(true);
    expect(isFinalizedSubmissionStatus(SubmissionStatus.APPROVED)).toBe(true);
  });

  it('allows valid transitions and rejects invalid ones', () => {
    expect(() =>
      assertSubmissionStatusTransition(SubmissionStatus.DRAFT, SubmissionStatus.SUBMITTED),
    ).not.toThrow();
    expect(() =>
      assertSubmissionStatusTransition(SubmissionStatus.DRAFT, SubmissionStatus.FLAGGED),
    ).not.toThrow();
    expect(() =>
      assertSubmissionStatusTransition(SubmissionStatus.SUBMITTED, SubmissionStatus.FLAGGED),
    ).not.toThrow();
    expect(() =>
      assertSubmissionStatusTransition(SubmissionStatus.FLAGGED, SubmissionStatus.APPROVED),
    ).not.toThrow();
    expect(() =>
      assertSubmissionStatusTransition(SubmissionStatus.FLAGGED, SubmissionStatus.FAILED),
    ).not.toThrow();

    expect(() =>
      assertSubmissionStatusTransition(SubmissionStatus.DRAFT, SubmissionStatus.APPROVED),
    ).toThrow(/Invalid submission status transition/);
    expect(() =>
      assertSubmissionStatusTransition(SubmissionStatus.APPROVED, SubmissionStatus.FAILED),
    ).toThrow(/Invalid submission status transition/);
    expect(() =>
      assertSubmissionStatusTransition(SubmissionStatus.FAILED, SubmissionStatus.APPROVED),
    ).toThrow(/Invalid submission status transition/);
  });

  it('allows no-op same-status transitions', () => {
    expect(() =>
      assertSubmissionStatusTransition(SubmissionStatus.FLAGGED, SubmissionStatus.FLAGGED),
    ).not.toThrow();
  });
});
