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
