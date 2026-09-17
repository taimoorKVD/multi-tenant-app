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
  /** Frontend field */
  date?: string | null;
  /** Legacy field */
  startDate?: string | null;
  endDate?: string | null;
  /** Frontend nested schedule (UI or canonical) */
  recurring?: FrequencyScheduleRaw | FrequencyScheduleInput | null;
  /** Legacy nested schedule */
  schedule?: FrequencyScheduleRaw | FrequencyScheduleInput | null;
  jobPosition?: number[] | number | null;
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
   * Expand frequency into due dates.
   * Supports:
   * - `{ type: "atOnce", date: "2026-08-21", recurring: null }`
   * - Canonical `{ recurring: { interval, unit, repeat, monthlyRule? } }`
   * - UI Frequency card `{ recurring: { every, interval: "day", repeatCount, daysOfWeek, monthMode, ... } }`
   *   (`repeatCount: 1` / omitted → open-ended up to maxOccurrences; use ≥2 for a finite series)
   * - Legacy `{ type: "one_time"|"recurring", startDate, schedule }`
   * Recurring without `date`/`startDate` anchors to today (UTC).
   */
  expandOccurrences(frequency: FrequencyInput | null | undefined, maxOccurrences = 100): Date[] {
    if (!frequency) return [];

    const end = frequency.endDate ? this.parseDateOnly(frequency.endDate) : null;
    const type = String(frequency.type || FrequencyType.AT_ONCE).toLowerCase();

    const isAtOnce =
      type === FrequencyType.AT_ONCE.toLowerCase() ||
      type === FrequencyType.ONE_TIME ||
      type === 'one-time' ||
      type === 'atonce' ||
      type === 'at_once';

    let startRaw = frequency.date || frequency.startDate;
    // Recurring Frequency card has no Date field — anchor schedule to today when omitted.
    if ((!startRaw || String(startRaw).trim() === '') && !isAtOnce) {
      startRaw = this.todayUtcDateOnly();
    }
    if (!startRaw) return [];

    const start = this.parseDateOnly(String(startRaw));
    if (!start) return [];

    if (isAtOnce) {
      return end && start > end ? [] : [start];
    }

    const raw = (frequency.recurring || frequency.schedule) as FrequencyScheduleRaw | null | undefined;
    if (!raw) {
      return [start];
    }

    const schedule = this.normalizeSchedule(raw, maxOccurrences);
    const dates: Date[] = [];

    if (
      String(schedule.unit).toLowerCase() === FrequencyUnit.WEEK &&
      schedule.daysOfWeek &&
      schedule.daysOfWeek.length
    ) {
      return this.expandWeeklyByDays(start, schedule, end, maxOccurrences);
    }

    let cursor = new Date(start.getTime());

    for (let i = 0; i < schedule.repeat; i++) {
      const due = this.applyMonthlyRule(cursor, schedule.unit, schedule.monthlyRule);
      if (end && due > end) break;
      dates.push(due);
      cursor = this.addInterval(cursor, schedule.interval, schedule.unit);
    }

    return dates;
  }

  /**
   * Normalize UI + legacy recurring payloads into a canonical schedule.
   *
   * UI shape:
   * `{ every: 1, interval: "day", repeatCount: 5, daysOfWeek: [], monthMode, dayOfMonth, ... }`
   * Canonical:
   * `{ interval: 1, unit: "day", repeat: 5, monthlyRule?, daysOfWeek? }`
   */
  normalizeSchedule(raw: FrequencyScheduleRaw, maxOccurrences = 100): FrequencyScheduleInput {
    const unit = this.resolveUnit(raw);
    const interval = this.resolveIntervalCount(raw);
    const repeat = this.resolveRepeat(raw, maxOccurrences);
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
        // A true one-shot belongs on atOnce — recurring × 1 means open-ended until capped.
        if (Math.floor(n) === 1) return maxOccurrences;
        return Math.min(Math.floor(n), maxOccurrences);
      }
    }

    if (raw.repeat != null && raw.repeat !== '') {
      const n = Number(raw.repeat);
      if (Number.isFinite(n) && n >= 1) return Math.min(Math.floor(n), maxOccurrences);
    }

    // Recurring with no end count → open-ended (capped).
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
