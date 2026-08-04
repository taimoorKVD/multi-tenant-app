import { Injectable } from '@nestjs/common';
import {
  FrequencyType,
  FrequencyUnit,
  MonthlyRuleType,
  WeekdayOrdinal,
} from '../entities/enums';

export type FrequencyInput = {
  type: FrequencyType | string;
  startDate: string;
  endDate?: string | null;
  schedule?: {
    interval: number;
    unit: FrequencyUnit | string;
    repeat: number;
    monthlyRule?: {
      type: MonthlyRuleType | string;
      day?: number;
      ordinal?: WeekdayOrdinal | string;
      weekday?: string;
      month?: string;
    };
  };
};

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

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

@Injectable()
export class FrequencyService {
  /**
   * Expand frequency config into due dates (UTC midnight of each occurrence date).
   * Matches Create Form Frequency step: one_time | recurring with On day / On the rules.
   */
  expandOccurrences(frequency: FrequencyInput | null | undefined, maxOccurrences = 100): Date[] {
    if (!frequency?.startDate) return [];

    const start = this.parseDateOnly(frequency.startDate);
    if (!start) return [];

    const end = frequency.endDate ? this.parseDateOnly(frequency.endDate) : null;
    const type = String(frequency.type || FrequencyType.ONE_TIME).toLowerCase();

    if (type === FrequencyType.ONE_TIME || type === 'one-time') {
      return end && start > end ? [] : [start];
    }

    const schedule = frequency.schedule;
    if (!schedule?.interval || !schedule.unit || !schedule.repeat) {
      return [start];
    }

    const interval = Math.max(1, Number(schedule.interval) || 1);
    const unit = String(schedule.unit).toLowerCase() as FrequencyUnit;
    const repeat = Math.min(Math.max(1, Number(schedule.repeat) || 1), maxOccurrences);
    const dates: Date[] = [];

    let cursor = new Date(start.getTime());

    for (let i = 0; i < repeat; i++) {
      const due = this.applyMonthlyRule(cursor, unit, schedule.monthlyRule);
      if (end && due > end) break;
      dates.push(due);
      cursor = this.addInterval(cursor, interval, unit);
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
    rule?: FrequencyInput['schedule'] extends infer S
      ? S extends { monthlyRule?: infer R }
        ? R
        : undefined
      : undefined,
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
    // UI may send a month name in the second dropdown for yearly "On the" — treat as 1st of that month.
    if (MONTH_INDEX[weekdayKey] !== undefined && !WEEKDAY_INDEX[weekdayKey]) {
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
