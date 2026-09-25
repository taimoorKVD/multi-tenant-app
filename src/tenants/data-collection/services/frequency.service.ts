import { Injectable } from '@nestjs/common';
import {
  FrequencyType,
  FrequencyUnit,
  MonthlyRuleType,
  WeekdayOrdinal,
} from '../entities/enums';

export type FrequencyMonthlyRule = {
  type: MonthlyRuleType | string;
  day?: number;
  ordinal?: WeekdayOrdinal | string;
  weekday?: string;
  month?: string;
};

export type FrequencyScheduleInput = {
  interval: number;
  unit: FrequencyUnit | string;
  repeat: number;
  monthlyRule?: FrequencyMonthlyRule;
  /** UI weekly BYDAY list (e.g. ["monday","wednesday"]). */
  daysOfWeek?: string[];
};

/** Loose recurring/schedule payload from UI or legacy API. */
export type FrequencyScheduleRaw = Record<string, any>;

export type FrequencyInput = {
  type?: FrequencyType | string;
  /** Frontend one-time date (YYYY-MM-DD) */
  date?: string | null;
  /** Recurring series start (YYYY-MM-DD); also legacy alias for `date` */
  startDate?: string | null;
  /** Recurring series end (YYYY-MM-DD) */
  endDate?: string | null;
  /**
   * Single due clock time (`HH:mm` 24h or `h:mm AM/PM`).
   * Used when `times` is empty / omitted (typically at-once).
   */
  time?: string | null;
  /**
   * Due clock times per occurrence day (typically recurring).
   * Used for any `repeatCount` (1 or more). Each occurrence date × each time → one assignment dueAt.
   */
  times?: string[] | null;
  /** Read-only UI helpers added by `enrichFrequencyForUi` (not required on write). */
  timeAmPm?: string;
  timeParts?: { hour: string; minute: string; period: 'AM' | 'PM' };
  timesAmPm?: string[];
  timesParts?: Array<{ hour: string; minute: string; period: 'AM' | 'PM' }>;
  /** Frontend nested schedule (UI or canonical) */
  recurring?: FrequencyScheduleRaw | FrequencyScheduleInput | null;
  /** Legacy nested schedule */
  schedule?: FrequencyScheduleRaw | FrequencyScheduleInput | null;
  jobPosition?: number[] | number | null;
  /**
   * Flat UI schedule fields may also live on the frequency root
   * (every / interval / repeatCount / daysOfWeek / monthMode / …).
   */
  [key: string]: unknown;
};

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const WEEKDAY_NAME_BY_INDEX = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const UNIT_ALIASES: Record<string, FrequencyUnit> = {
  day: FrequencyUnit.DAY,
  days: FrequencyUnit.DAY,
  daily: FrequencyUnit.DAY,
  week: FrequencyUnit.WEEK,
  weeks: FrequencyUnit.WEEK,
  weekly: FrequencyUnit.WEEK,
  month: FrequencyUnit.MONTH,
  months: FrequencyUnit.MONTH,
  monthly: FrequencyUnit.MONTH,
  year: FrequencyUnit.YEAR,
  years: FrequencyUnit.YEAR,
  yearly: FrequencyUnit.YEAR,
  annually: FrequencyUnit.YEAR,
};

const OPEN_ENDED_HORIZON_MONTHS = 12;
const MAX_OCCURRENCES_WITHIN_HORIZON = 1000;

@Injectable()
export class FrequencyService {
  /** UTC today as YYYY-MM-DD when Recurring UI omits `date`. */
  private todayUtcDateOnly(): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Human-readable frequency for admin boards (e.g. "Yearly · Jan 1", "Daily", "Monthly · 1st").
   */
  formatFrequencyLabel(frequency: FrequencyInput | null | undefined): string {
    if (!frequency || typeof frequency !== 'object') return '—';

    const type = String(frequency.type || FrequencyType.AT_ONCE).toLowerCase();
    const isAtOnce =
      type === FrequencyType.AT_ONCE.toLowerCase() ||
      type === FrequencyType.ONE_TIME ||
      type === 'one-time' ||
      type === 'atonce' ||
      type === 'at_once';

    const startRaw = frequency.date || frequency.startDate;
    const start = startRaw ? this.parseDateOnly(String(startRaw)) : null;

    if (isAtOnce) {
      if (!start) return 'Once';
      const times = this.resolveOccurrenceTimes(frequency);
      const clock = times[0];
      if (clock && (clock.hours !== 0 || clock.minutes !== 0)) {
        return `Once · ${this.formatShortDate(start)}, ${this.formatTimeAmPm(clock.hours, clock.minutes)}`;
      }
      return `Once · ${this.formatShortDate(start)}`;
    }

    const raw = this.resolveScheduleRaw(frequency);
    if (!raw) {
      return start ? `Once · ${this.formatShortDate(start)}` : 'Once';
    }

    const schedule = this.normalizeSchedule(raw);
    const unit = String(schedule.unit).toLowerCase();
    const interval = Math.max(1, schedule.interval || 1);

    if (unit === FrequencyUnit.DAY) {
      return interval === 1 ? 'Daily' : `Every ${interval} days`;
    }

    if (unit === FrequencyUnit.WEEK) {
      const days = (schedule.daysOfWeek || [])
        .map((d) => this.shortWeekday(d))
        .filter(Boolean);
      const base = interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
      return days.length ? `${base} · ${days.join(', ')}` : base;
    }

    if (unit === FrequencyUnit.MONTH) {
      const base = interval === 1 ? 'Monthly' : `Every ${interval} months`;
      const detail = this.formatMonthlyRuleDetail(schedule.monthlyRule, start);
      return detail ? `${base} · ${detail}` : base;
    }

    if (unit === FrequencyUnit.YEAR) {
      const base = interval === 1 ? 'Yearly' : `Every ${interval} years`;
      const detail = this.formatYearlyDetail(schedule.monthlyRule, start);
      return detail ? `${base} · ${detail}` : base;
    }

    return 'Recurring';
  }

  private formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  private shortWeekday(value: string): string {
    const key = String(value || '').toLowerCase().trim();
    const idx = WEEKDAY_INDEX[key];
    if (idx === undefined) return '';
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx];
  }

  private formatOrdinalDay(day: number): string {
    const abs = Math.abs(day);
    const mod100 = abs % 100;
    const mod10 = abs % 10;
    const suffix =
      mod100 >= 11 && mod100 <= 13
        ? 'th'
        : mod10 === 1
          ? 'st'
          : mod10 === 2
            ? 'nd'
            : mod10 === 3
              ? 'rd'
              : 'th';
    return `${day}${suffix}`;
  }

  private formatMonthlyRuleDetail(
    rule: FrequencyMonthlyRule | undefined,
    start: Date | null,
  ): string | null {
    if (rule?.type) {
      const type = String(rule.type);
      if (type === MonthlyRuleType.DAY_OF_MONTH || type === 'dayOfMonth') {
        const day = rule.day ?? start?.getUTCDate();
        if (day == null) return null;
        if (day === -1) return 'Last day';
        return this.formatOrdinalDay(day);
      }
      if (type === MonthlyRuleType.NTH_WEEKDAY || type === 'nthWeekday') {
        const ordinal = String(rule.ordinal || 'first');
        const weekday = this.shortWeekday(String(rule.weekday || ''));
        const ordLabel = ordinal.charAt(0).toUpperCase() + ordinal.slice(1);
        return weekday ? `${ordLabel} ${weekday}` : ordLabel;
      }
    }
    if (start) return this.formatOrdinalDay(start.getUTCDate());
    return null;
  }

  private formatYearlyDetail(
    rule: FrequencyMonthlyRule | undefined,
    start: Date | null,
  ): string | null {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    if (rule?.month) {
      const idx = MONTH_INDEX[String(rule.month).toLowerCase()];
      if (idx !== undefined) {
        const day = rule.day ?? start?.getUTCDate() ?? 1;
        return `${monthNames[idx]} ${day}`;
      }
    }

    if (start) {
      return `${monthNames[start.getUTCMonth()]} ${start.getUTCDate()}`;
    }
    return null;
  }

  /**
   * Expand frequency into due timestamps (UTC date + clock time).
   * Supports:
   * - Flat UI `{ type, date|startDate, endDate, time|times, every, interval, repeatCount, ... }`
   * - `{ type: "atOnce", date: "2026-08-21", time: "15:06" }`
   * - Nested `{ recurring: { every, interval, repeatCount, ... } }` / canonical / legacy `schedule`
   *   (`repeatCount: 1` / omitted → open-ended for the next 12 months when no `endDate`)
   * - When `endDate` is set, the series is bounded by that day (date count not truncated by `repeatCount`)
   * - At-once: `time`; recurring: `times[]` (any length, including when `repeatCount` is 1)
   *   → one dueAt per occurrence date × each clock time
   * Recurring without `date`/`startDate` anchors to today (UTC).
   */
  expandOccurrences(
    frequency: FrequencyInput | null | undefined,
    maxOccurrences = MAX_OCCURRENCES_WITHIN_HORIZON,
  ): Date[] {
    if (!frequency) return [];

    const end = frequency.endDate ? this.parseDateOnly(String(frequency.endDate)) : null;
    const type = String(frequency.type || FrequencyType.AT_ONCE).toLowerCase();

    const isAtOnce =
      type === FrequencyType.AT_ONCE.toLowerCase() ||
      type === FrequencyType.ONE_TIME ||
      type === 'one-time' ||
      type === 'atonce' ||
      type === 'at_once';

    // Prefer startDate for recurring window; `date` remains the atOnce field.
    let startRaw = isAtOnce
      ? frequency.date || frequency.startDate
      : frequency.startDate || frequency.date;
    const hasExplicitStartDate =
      !isAtOnce &&
      frequency.startDate != null &&
      String(frequency.startDate).trim() !== '';
    // Recurring Frequency card may omit date — anchor schedule to today when omitted.
    if ((!startRaw || String(startRaw).trim() === '') && !isAtOnce) {
      startRaw = this.todayUtcDateOnly();
    }
    if (!startRaw) return [];

    const start = this.parseDateOnly(String(startRaw));
    if (!start) return [];

    const clockTimes = this.resolveOccurrenceTimes(frequency);
    const dateBudget = Math.max(1, Math.floor(maxOccurrences / Math.max(1, clockTimes.length)));

    if (isAtOnce) {
      if (end && start > end) return [];
      return this.applyTimesToDates([start], clockTimes);
    }

    const raw = this.resolveScheduleRaw(frequency);
    if (!raw) {
      return this.applyTimesToDates([start], clockTimes);
    }

    // When endDate bounds the window, expand until that day (recurring `times[]`
    // multiplies each date; do not also truncate the window by UI repeatCount).
    const boundedByEndDate = !!end;
    const openEnded = boundedByEndDate || this.isOpenEndedSchedule(raw);
    const horizonExclusive = openEnded && !boundedByEndDate
      ? this.addCalendarMonths(start, OPEN_ENDED_HORIZON_MONTHS)
      : null;
    const schedule = this.normalizeSchedule(
      raw,
      dateBudget,
      boundedByEndDate ? { forceOpenEnded: true } : undefined,
    );
    const dates: Date[] = [];

    if (
      String(schedule.unit).toLowerCase() === FrequencyUnit.WEEK &&
      schedule.daysOfWeek &&
      schedule.daysOfWeek.length
    ) {
      const weeklyDates = this.expandWeeklyByDays(
        start,
        schedule,
        end,
        horizonExclusive,
        dateBudget,
      );
      return this.applyTimesToDates(weeklyDates, clockTimes);
    }

    let cursor = new Date(start.getTime());

    for (let generated = 0; generated < schedule.repeat; ) {
      const due = this.applyMonthlyRule(cursor, schedule.unit, schedule.monthlyRule);
      if (end && due > end) break;
      if (horizonExclusive && due >= horizonExclusive) break;
      const next = this.addInterval(cursor, schedule.interval, schedule.unit);
      // With explicit startDate (window mode), skip rule dates before the window
      // (e.g. dayOfMonth:1 when startDate is mid-month). Legacy `date`-only anchors
      // still allow the first rule application in the anchor year/month cycle.
      if (hasExplicitStartDate && due < start) {
        if (next.getTime() <= cursor.getTime()) break;
        cursor = next;
        continue;
      }
      dates.push(due);
      generated++;
      cursor = next;
    }

    return this.applyTimesToDates(dates, clockTimes);
  }

  /**
   * Resolve schedule object from nested `recurring`/`schedule` or flat UI root fields.
   */
  resolveScheduleRaw(frequency: FrequencyInput): FrequencyScheduleRaw | null {
    const nested = (frequency.recurring || frequency.schedule) as
      | FrequencyScheduleRaw
      | null
      | undefined;
    if (nested && typeof nested === 'object') return nested;

    if (this.hasFlatScheduleFields(frequency)) {
      return frequency as FrequencyScheduleRaw;
    }
    return null;
  }

  /** True when schedule knobs live on the frequency root (flat UI payload). */
  private hasFlatScheduleFields(frequency: FrequencyInput): boolean {
    const keys = [
      'every',
      'interval',
      'repeatCount',
      'repeat',
      'unit',
      'daysOfWeek',
      'monthMode',
      'dayOfMonth',
      'weekOrder',
      'onTheMonth',
      'yearMonth',
      'yearDay',
      'monthlyRule',
    ];
    return keys.some((key) => {
      const value = frequency[key];
      if (value == null || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    });
  }

  /**
   * Clock times for each occurrence day.
   * Prefers non-empty `times[]` then singular `time`, on the frequency root first,
   * then nested `recurring` / `schedule` (UI often nests times there).
   * Else midnight (legacy date-only).
   */
  resolveOccurrenceTimes(frequency: FrequencyInput): Array<{ hours: number; minutes: number }> {
    const nested = (frequency.recurring || frequency.schedule) as
      | FrequencyScheduleRaw
      | null
      | undefined;

    const fromRootTimes = this.parseTimesList(frequency.times);
    if (fromRootTimes.length) return this.sortClockTimes(fromRootTimes);

    const rootSingle = this.parseClockTime(
      frequency.time != null ? String(frequency.time) : null,
    );
    if (rootSingle) return [rootSingle];

    if (nested && typeof nested === 'object') {
      const fromNestedTimes = this.parseTimesList(nested.times);
      if (fromNestedTimes.length) return this.sortClockTimes(fromNestedTimes);

      const nestedSingle = this.parseClockTime(
        nested.time != null ? String(nested.time) : null,
      );
      if (nestedSingle) return [nestedSingle];
    }

    return [{ hours: 0, minutes: 0 }];
  }

  private parseTimesList(value: unknown): Array<{ hours: number; minutes: number }> {
    if (!Array.isArray(value)) return [];
    return value
      .map((t) => this.parseClockTime(t))
      .filter((t): t is { hours: number; minutes: number } => t != null);
  }

  /** Stable chronological order so same-day slots list as morning → evening. */
  private sortClockTimes(
    times: Array<{ hours: number; minutes: number }>,
  ): Array<{ hours: number; minutes: number }> {
    return [...times].sort((a, b) => a.hours * 60 + a.minutes - (b.hours * 60 + b.minutes));
  }

  /**
   * Parse `HH:mm` (24h) or `h:mm AM/PM` into UTC clock parts.
   * Example: `"15:06"` → `{ hours: 15, minutes: 6 }` (display as 3:06 PM).
   */
  parseClockTime(value: string | null | undefined): { hours: number; minutes: number } | null {
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw);
    if (ampm) {
      let hours = Number(ampm[1]);
      const minutes = Number(ampm[2]);
      const meridiem = ampm[3].toUpperCase();
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
      if (meridiem === 'AM') {
        if (hours === 12) hours = 0;
      } else if (hours !== 12) {
        hours += 12;
      }
      return { hours, minutes };
    }

    const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(raw);
    if (twentyFour) {
      const hours = Number(twentyFour[1]);
      const minutes = Number(twentyFour[2]);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
      return { hours, minutes };
    }

    return null;
  }

  /** Format UTC clock as `h:mm AM/PM` (e.g. 15:06 → `3:06 PM`). */
  formatTimeAmPm(hours: number, minutes: number): string {
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
  }

  /**
   * Split a clock into Hour / Minute / Period fields matching the Frequency UI picker.
   * Example: 22:33 → `{ hour: "10", minute: "33", period: "PM" }`.
   */
  toTimeParts(
    hours: number,
    minutes: number,
  ): { hour: string; minute: string; period: 'AM' | 'PM' } {
    const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return {
      hour: String(hour12).padStart(2, '0'),
      minute: String(minutes).padStart(2, '0'),
      period,
    };
  }

  /**
   * Enrich frequency for edit forms (does not mutate storage).
   * Adds `timeAmPm` / `timeParts` and `timesAmPm` / `timesParts` so the UI can
   * bind Hour/Minute/Period without re-parsing 24h `HH:mm` (e.g. `"22:33"` → 10:33 PM).
   * Also resolves nested `recurring.times` / `schedule.times` onto the root helpers.
   */
  enrichFrequencyForUi(frequency: FrequencyInput | null | undefined): FrequencyInput | null {
    if (!frequency || typeof frequency !== 'object') return frequency ?? null;

    const enriched: FrequencyInput = { ...frequency };
    const nested = (frequency.recurring || frequency.schedule) as
      | FrequencyScheduleRaw
      | null
      | undefined;

    if (frequency.time != null && String(frequency.time).trim() !== '') {
      const parsed = this.parseClockTime(String(frequency.time));
      if (parsed) {
        enriched.timeAmPm = this.formatTimeAmPm(parsed.hours, parsed.minutes);
        enriched.timeParts = this.toTimeParts(parsed.hours, parsed.minutes);
      }
    }

    const rootTimes = Array.isArray(frequency.times) ? frequency.times : null;
    const nestedTimes =
      nested && typeof nested === 'object' && Array.isArray(nested.times) ? nested.times : null;
    const timesSource =
      rootTimes && rootTimes.length
        ? rootTimes
        : nestedTimes && nestedTimes.length
          ? nestedTimes
          : null;

    if (timesSource) {
      const parts: Array<{ hour: string; minute: string; period: 'AM' | 'PM' }> = [];
      const labels: string[] = [];
      for (const raw of timesSource) {
        const parsed = this.parseClockTime(raw);
        if (!parsed) continue;
        parts.push(this.toTimeParts(parsed.hours, parsed.minutes));
        labels.push(this.formatTimeAmPm(parsed.hours, parsed.minutes));
      }
      if (parts.length) {
        enriched.timesParts = parts;
        enriched.timesAmPm = labels;
        // Mirror helpers onto nested recurring when that is where times live.
        if ((!rootTimes || !rootTimes.length) && nested && typeof nested === 'object') {
          const nestedKey = frequency.recurring ? 'recurring' : 'schedule';
          enriched[nestedKey] = {
            ...nested,
            timesAmPm: labels,
            timesParts: parts,
          };
        }
      }
    } else if (
      !enriched.timeParts &&
      nested &&
      typeof nested === 'object' &&
      nested.time != null &&
      String(nested.time).trim() !== ''
    ) {
      const parsed = this.parseClockTime(String(nested.time));
      if (parsed) {
        enriched.timeAmPm = this.formatTimeAmPm(parsed.hours, parsed.minutes);
        enriched.timeParts = this.toTimeParts(parsed.hours, parsed.minutes);
        const nestedKey = frequency.recurring ? 'recurring' : 'schedule';
        enriched[nestedKey] = {
          ...nested,
          timeAmPm: enriched.timeAmPm,
          timeParts: enriched.timeParts,
        };
      }
    }

    return enriched;
  }

  formatDateTimeAmPm(date: Date): string {
    const datePart = this.formatShortDate(date);
    if (!this.hasClockTime(date)) return datePart;
    return `${datePart}, ${this.formatTimeAmPm(date.getUTCHours(), date.getUTCMinutes())}`;
  }

  /** True when dueAt carries a non-midnight clock time. */
  hasClockTime(date: Date): boolean {
    return (
      date.getUTCHours() !== 0 ||
      date.getUTCMinutes() !== 0 ||
      date.getUTCSeconds() !== 0 ||
      date.getUTCMilliseconds() !== 0
    );
  }

  private applyTimesToDates(
    dates: Date[],
    times: Array<{ hours: number; minutes: number }>,
  ): Date[] {
    if (!dates.length) return [];
    const clocks = times.length ? times : [{ hours: 0, minutes: 0 }];
    const result: Date[] = [];
    for (const day of dates) {
      for (const clock of clocks) {
        result.push(
          new Date(
            Date.UTC(
              day.getUTCFullYear(),
              day.getUTCMonth(),
              day.getUTCDate(),
              clock.hours,
              clock.minutes,
              0,
              0,
            ),
          ),
        );
      }
    }
    return result;
  }

  /**
   * Normalize UI + legacy recurring payloads into a canonical schedule.
   *
   * UI shape:
   * `{ every: 1, interval: "day", repeatCount: 5, daysOfWeek: [], monthMode, dayOfMonth, ... }`
   * Canonical:
   * `{ interval: 1, unit: "day", repeat: 5, monthlyRule?, daysOfWeek? }`
   */
  normalizeSchedule(
    raw: FrequencyScheduleRaw,
    maxOccurrences = MAX_OCCURRENCES_WITHIN_HORIZON,
    options?: { forceOpenEnded?: boolean },
  ): FrequencyScheduleInput {
    const unit = this.resolveUnit(raw);
    const interval = this.resolveIntervalCount(raw);
    const repeat = options?.forceOpenEnded
      ? maxOccurrences
      : this.resolveRepeat(raw, maxOccurrences);
    const daysOfWeek = this.resolveDaysOfWeek(raw);
    const monthlyRule = this.resolveMonthlyRule(raw, unit, daysOfWeek);

    return {
      interval,
      unit,
      repeat,
      ...(monthlyRule ? { monthlyRule } : {}),
      ...(daysOfWeek.length ? { daysOfWeek } : {}),
    };
  }

  private isOpenEndedSchedule(raw: FrequencyScheduleRaw): boolean {
    if (
      raw.repeat === true ||
      String(raw.ends || raw.endType || '').toLowerCase() === 'never'
    ) {
      return true;
    }

    if (raw.repeatCount != null && raw.repeatCount !== '') {
      const repeatCount = Number(raw.repeatCount);
      if (Number.isFinite(repeatCount) && repeatCount >= 1) {
        return Math.floor(repeatCount) === 1;
      }
    }

    if (raw.repeat != null && raw.repeat !== '') {
      const repeat = Number(raw.repeat);
      if (Number.isFinite(repeat) && repeat >= 1) return false;
    }

    return true;
  }

  private resolveUnit(raw: FrequencyScheduleRaw): FrequencyUnit {
    if (raw.unit != null && String(raw.unit).trim() !== '') {
      const fromUnit = UNIT_ALIASES[String(raw.unit).toLowerCase().trim()];
      if (fromUnit) return fromUnit;
    }

    // UI stores unit name in `interval` ("day" | "week" | "month" | "year").
    if (typeof raw.interval === 'string') {
      const fromInterval = UNIT_ALIASES[raw.interval.toLowerCase().trim()];
      if (fromInterval) return fromInterval;
    }

    return FrequencyUnit.MONTH;
  }

  private resolveIntervalCount(raw: FrequencyScheduleRaw): number {
    if (raw.every != null && raw.every !== '') {
      const n = Number(raw.every);
      if (Number.isFinite(n) && n >= 1) return Math.floor(n);
    }

    // Canonical numeric interval (not the UI unit string).
    if (typeof raw.interval === 'number' || (typeof raw.interval === 'string' && !UNIT_ALIASES[String(raw.interval).toLowerCase().trim()])) {
      const n = Number(raw.interval);
      if (Number.isFinite(n) && n >= 1) return Math.floor(n);
    }

    return 1;
  }

  private resolveRepeat(raw: FrequencyScheduleRaw, maxOccurrences: number): number {
    // Explicit open-ended (seeds / UI "Ends: Never").
    if (
      raw.repeat === true ||
      String(raw.ends || raw.endType || '').toLowerCase() === 'never'
    ) {
      return maxOccurrences;
    }

    if (raw.repeatCount != null && raw.repeatCount !== '') {
      const n = Number(raw.repeatCount);
      if (Number.isFinite(n) && n >= 1) {
        // Frequency UI defaults "Ends after" to 1 while configuring "every N days/weeks".
        // A true one-shot belongs on atOnce — recurring × 1 means open-ended.
        if (Math.floor(n) === 1) return maxOccurrences;
        return Math.min(Math.floor(n), maxOccurrences);
      }
    }

    if (raw.repeat != null && raw.repeat !== '') {
      const n = Number(raw.repeat);
      if (Number.isFinite(n) && n >= 1) {
        return Math.min(Math.floor(n), maxOccurrences);
      }
    }

    // Recurring with no end count → open-ended (bounded by the 12-month horizon).
    return maxOccurrences;
  }

  private resolveDaysOfWeek(raw: FrequencyScheduleRaw): string[] {
    const source = raw.daysOfWeek ?? raw.weekdays ?? raw.byDay;
    if (!Array.isArray(source)) return [];

    const names: string[] = [];
    for (const item of source) {
      if (item == null || item === '') continue;
      if (typeof item === 'number' && item >= 0 && item <= 6) {
        names.push(WEEKDAY_NAME_BY_INDEX[item]);
        continue;
      }
      const key = String(item).toLowerCase().trim();
      const idx = WEEKDAY_INDEX[key];
      if (idx !== undefined) {
        names.push(WEEKDAY_NAME_BY_INDEX[idx]);
      }
    }

    // Stable unique order Sun→Sat.
    return [...new Set(names)].sort(
      (a, b) => (WEEKDAY_INDEX[a] ?? 0) - (WEEKDAY_INDEX[b] ?? 0),
    );
  }

  private resolveMonthlyRule(
    raw: FrequencyScheduleRaw,
    unit: FrequencyUnit,
    daysOfWeek: string[],
  ): FrequencyMonthlyRule | undefined {
    if (raw.monthlyRule && typeof raw.monthlyRule === 'object') {
      return raw.monthlyRule as FrequencyMonthlyRule;
    }

    const unitKey = String(unit).toLowerCase();
    if (unitKey !== FrequencyUnit.MONTH && unitKey !== FrequencyUnit.YEAR) {
      return undefined;
    }

    const mode = String(raw.monthMode || raw.monthlyMode || raw.ruleType || '')
      .toLowerCase()
      .trim();
    const isNth =
      mode === 'nthweekday' ||
      mode === 'nth_weekday' ||
      mode === 'onthe' ||
      mode === 'on_the' ||
      mode === MonthlyRuleType.NTH_WEEKDAY.toLowerCase();

    if (isNth) {
      const weekday =
        this.firstWeekdayName(raw.weekday ?? raw.onTheWeekday ?? daysOfWeek[0]) || 'monday';
      return {
        type: MonthlyRuleType.NTH_WEEKDAY,
        ordinal: String(raw.weekOrder || raw.ordinal || WeekdayOrdinal.FIRST).toLowerCase(),
        weekday,
        ...(unitKey === FrequencyUnit.YEAR
          ? { month: String(raw.onTheMonth || raw.yearMonth || raw.month || 'january').toLowerCase() }
          : {}),
      };
    }

    // Default / dayOfMonth (UI always sends monthMode:"dayOfMonth" with dayOfMonth).
    const daySource =
      unitKey === FrequencyUnit.YEAR
        ? (raw.yearDay ?? raw.dayOfMonth ?? raw.day)
        : (raw.dayOfMonth ?? raw.day);
    const day = daySource === '' || daySource == null ? undefined : Number(daySource);
    const month =
      unitKey === FrequencyUnit.YEAR
        ? String(raw.yearMonth || raw.onTheMonth || raw.month || 'january').toLowerCase()
        : undefined;

    // Only attach a rule when UI provided month-specific fields or an explicit monthlyRule.
    const hasUiMonthFields =
      raw.dayOfMonth != null ||
      raw.yearDay != null ||
      raw.yearMonth != null ||
      raw.monthMode != null ||
      raw.month != null ||
      raw.onTheMonth != null;

    // Canonical `{ unit: "month"|"year", interval, repeat }` with no rule fields
    // should keep the start date's day/month and only advance by interval.
    if (!hasUiMonthFields) {
      return undefined;
    }

    return {
      type: MonthlyRuleType.DAY_OF_MONTH,
      day: Number.isFinite(day as number) ? (day as number) : 1,
      ...(month ? { month } : {}),
    };
  }

  private firstWeekdayName(value: unknown): string | undefined {
    if (value == null || value === '') return undefined;
    if (typeof value === 'number' && value >= 0 && value <= 6) {
      return WEEKDAY_NAME_BY_INDEX[value];
    }
    const key = String(value).toLowerCase().trim();
    const idx = WEEKDAY_INDEX[key];
    return idx !== undefined ? WEEKDAY_NAME_BY_INDEX[idx] : undefined;
  }

  /**
   * Weekly with selected weekdays (RRULE-like):
   * every N weeks on the listed days, COUNT = repeat.
   */
  private expandWeeklyByDays(
    start: Date,
    schedule: FrequencyScheduleInput,
    end: Date | null,
    horizonExclusive: Date | null,
    maxOccurrences: number,
  ): Date[] {
    const selected = (schedule.daysOfWeek || [])
      .map((d) => WEEKDAY_INDEX[String(d).toLowerCase()])
      .filter((n): n is number => n !== undefined);
    if (!selected.length) return [];

    const selectedSet = new Set(selected);
    const intervalWeeks = Math.max(1, schedule.interval);
    const repeat = Math.min(Math.max(1, schedule.repeat), maxOccurrences);
    const dates: Date[] = [];

    // Week anchor: Sunday of the start week (UTC).
    const startWeekSunday = new Date(start.getTime());
    startWeekSunday.setUTCDate(start.getUTCDate() - start.getUTCDay());

    // Scan forward day-by-day with a generous safety cap.
    const cursor = new Date(start.getTime());
    const safetyDays = Math.max(repeat * intervalWeeks * 7 * 2, 366 * 2);

    for (let i = 0; i < safetyDays && dates.length < repeat; i++) {
      if (horizonExclusive && cursor >= horizonExclusive) break;
      const dow = cursor.getUTCDay();
      if (selectedSet.has(dow) && cursor >= start) {
        const weekSunday = new Date(cursor.getTime());
        weekSunday.setUTCDate(cursor.getUTCDate() - dow);
        const weeksFromStart = Math.floor(
          (weekSunday.getTime() - startWeekSunday.getTime()) / (7 * 24 * 60 * 60 * 1000),
        );
        if (weeksFromStart >= 0 && weeksFromStart % intervalWeeks === 0) {
          if (end && cursor > end) break;
          dates.push(new Date(cursor.getTime()));
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates;
  }

  private addCalendarMonths(date: Date, months: number): Date {
    const targetMonth = date.getUTCMonth() + months;
    const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();

    return new Date(
      Date.UTC(
        targetYear,
        normalizedMonth,
        Math.min(date.getUTCDate(), lastDay),
        0,
        0,
        0,
        0,
      ),
    );
  }

  private parseDateOnly(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  private addInterval(date: Date, interval: number, unit: FrequencyUnit | string): Date {
    const next = new Date(date.getTime());
    switch (String(unit).toLowerCase()) {
      case FrequencyUnit.DAY:
        next.setUTCDate(next.getUTCDate() + interval);
        break;
      case FrequencyUnit.WEEK:
        next.setUTCDate(next.getUTCDate() + interval * 7);
        break;
      case FrequencyUnit.YEAR:
        next.setUTCFullYear(next.getUTCFullYear() + interval);
        break;
      case FrequencyUnit.MONTH:
      default:
        next.setUTCMonth(next.getUTCMonth() + interval);
        break;
    }
    return next;
  }

  private applyMonthlyRule(
    base: Date,
    unit: FrequencyUnit | string,
    rule?: FrequencyMonthlyRule,
  ): Date {
    if (!rule?.type) return new Date(base.getTime());

    const type = String(rule.type);
    const year = base.getUTCFullYear();
    let month = base.getUTCMonth();

    if (String(unit).toLowerCase() === FrequencyUnit.YEAR && rule.month) {
      const idx = MONTH_INDEX[String(rule.month).toLowerCase()];
      if (idx !== undefined) month = idx;
    }

    if (type === MonthlyRuleType.DAY_OF_MONTH || type === 'dayOfMonth') {
      const day = rule.day ?? base.getUTCDate();
      if (day === -1) {
        return new Date(Date.UTC(year, month + 1, 0, 0, 0, 0, 0));
      }
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const clamped = Math.min(Math.max(1, day), lastDay);
      return new Date(Date.UTC(year, month, clamped, 0, 0, 0, 0));
    }

    if (type === MonthlyRuleType.NTH_WEEKDAY || type === 'nthWeekday') {
      return this.nthWeekdayInMonth(year, month, rule.ordinal, rule.weekday);
    }

    return new Date(base.getTime());
  }

  private nthWeekdayInMonth(
    year: number,
    month: number,
    ordinal?: string,
    weekday?: string,
  ): Date {
    const weekdayKey = String(weekday || '').toLowerCase();
    if (MONTH_INDEX[weekdayKey] !== undefined && WEEKDAY_INDEX[weekdayKey] === undefined) {
      return new Date(Date.UTC(year, MONTH_INDEX[weekdayKey], 1, 0, 0, 0, 0));
    }

    const targetDow = WEEKDAY_INDEX[weekdayKey] ?? 1;
    const ord = String(ordinal || WeekdayOrdinal.FIRST).toLowerCase();

    if (ord === WeekdayOrdinal.LAST) {
      const lastDay = new Date(Date.UTC(year, month + 1, 0));
      const dow = lastDay.getUTCDay();
      const diff = (dow - targetDow + 7) % 7;
      lastDay.setUTCDate(lastDay.getUTCDate() - diff);
      return lastDay;
    }

    const ordinalIndex =
      ord === WeekdayOrdinal.SECOND
        ? 2
        : ord === WeekdayOrdinal.THIRD
          ? 3
          : ord === WeekdayOrdinal.FOURTH
            ? 4
            : 1;

    const first = new Date(Date.UTC(year, month, 1));
    const firstDow = first.getUTCDay();
    const offset = (targetDow - firstDow + 7) % 7;
    const day = 1 + offset + (ordinalIndex - 1) * 7;
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    if (day > lastDayOfMonth) {
      return new Date(Date.UTC(year, month + 1, 0, 0, 0, 0, 0));
    }
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }
}
