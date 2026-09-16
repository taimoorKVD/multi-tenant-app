export enum TemplateStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum AssignmentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

/** Why an assignment was cancelled — drives restore rematerialization rules. */
export enum AssignmentCancelReason {
  /** Open work cancelled because the template was archived/deleted. */
  TEMPLATE_ARCHIVED = 'template_archived',
  /** Cancelled by an explicit admin/employee action. */
  MANUAL = 'manual',
  /** Cancelled when a newer template version was published. */
  REPUBLISH = 'republish',
}

/** How assignees share responsibility for a form occurrence. */
export enum AssignmentType {
  /** Each assignee must complete their own copy. */
  INDIVIDUAL = 'individual',
  /** One submission completes the task for every assignee in the group. */
  SHARED = 'shared',
}

/** Employee-facing completion state for shared (and individual) assignments. */
export enum AssignmentCompletionState {
  COMPLETED = 'completed',
  COMPLETED_BY_ME = 'completed_by_me',
  COMPLETED_BY_OTHER = 'completed_by_other',
}

export enum SubmissionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
}

export enum FrequencyType {
  /** Frontend Frequency Type: At Once / one-time */
  AT_ONCE = 'atOnce',
  RECURRING = 'recurring',
  /** @deprecated Legacy alias — still accepted by FrequencyService */
  ONE_TIME = 'one_time',
}

export enum FrequencyUnit {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export enum MonthlyRuleType {
  DAY_OF_MONTH = 'dayOfMonth',
  NTH_WEEKDAY = 'nthWeekday',
}

export enum SectionType {
  RESPONSE_FORM = 'responseForm',
  DATA_ENTRY = 'dataEntry',
  CHECKLIST = 'checklist',
  VISUAL = 'visual',
}

export enum WeekdayOrdinal {
  FIRST = 'first',
  SECOND = 'second',
  THIRD = 'third',
  FOURTH = 'fourth',
  LAST = 'last',
}

export enum ConditionalOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  IS_EMPTY = 'IS_EMPTY',
  GREATER_THAN = 'GREATER_THAN',
}

export enum ConditionalActionType {
  SHOW = 'show',
  HIDE = 'hide',
  ENABLE = 'enable',
  DISABLE = 'disable',
}
