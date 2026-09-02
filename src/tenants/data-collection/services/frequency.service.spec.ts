import { FrequencyService } from './frequency.service';
import { FrequencyType, FrequencyUnit, MonthlyRuleType, WeekdayOrdinal } from '../entities/enums';

describe('FrequencyService', () => {
  const service = new FrequencyService();

  const isoDates = (dates: Date[]) => dates.map((d) => d.toISOString().slice(0, 10));

  it('expands frontend atOnce payload to a single date', () => {
    const dates = service.expandOccurrences({
      type: 'atOnce',
      date: '2026-08-21',
      jobPosition: null,
      recurring: null,
    });
    expect(dates).toHaveLength(1);
    expect(dates[0].toISOString().startsWith('2026-08-21')).toBe(true);
  });

  it('expands legacy one_time startDate', () => {
    const dates = service.expandOccurrences({
      type: FrequencyType.ONE_TIME,
      startDate: '2026-07-17',
    });
    expect(dates).toHaveLength(1);
    expect(dates[0].toISOString().startsWith('2026-07-17')).toBe(true);
  });

  it('expands recurring with nested recurring object', () => {
    const dates = service.expandOccurrences({
      type: FrequencyType.RECURRING,
      date: '2026-01-15',
      recurring: {
        interval: 1,
        unit: FrequencyUnit.MONTH,
        repeat: 3,
        monthlyRule: { type: MonthlyRuleType.DAY_OF_MONTH, day: 1 },
      },
    });
    expect(dates).toHaveLength(3);
    expect(dates.map((d) => d.getUTCDate())).toEqual([1, 1, 1]);
  });

  it('supports day=-1 as last day of month', () => {
    const dates = service.expandOccurrences({
      type: FrequencyType.RECURRING,
      date: '2026-02-01',
      recurring: {
        interval: 1,
        unit: FrequencyUnit.MONTH,
        repeat: 1,
        monthlyRule: { type: MonthlyRuleType.DAY_OF_MONTH, day: -1 },
      },
    });
    expect(dates).toHaveLength(1);
    expect(dates[0].getUTCDate()).toBe(28);
  });

  it('supports nth weekday rule via legacy schedule', () => {
    const dates = service.expandOccurrences({
      type: FrequencyType.RECURRING,
      startDate: '2026-07-01',
      schedule: {
        interval: 1,
        unit: FrequencyUnit.MONTH,
        repeat: 1,
        monthlyRule: {
          type: MonthlyRuleType.NTH_WEEKDAY,
          ordinal: WeekdayOrdinal.FIRST,
          weekday: 'monday',
        },
      },
    });
    expect(dates).toHaveLength(1);
    expect(dates[0].getUTCDay()).toBe(1);
  });

  it('defaults missing date to today for recurring payloads', () => {
    const today = new Date().toISOString().slice(0, 10);
    const dates = service.expandOccurrences({
      type: FrequencyType.RECURRING,
      date: null as any,
      recurring: {
        interval: 1,
        unit: FrequencyUnit.DAY,
        repeat: 2,
      },
    });
    expect(dates).toHaveLength(2);
    expect(dates[0].toISOString().startsWith(today)).toBe(true);
  });

  it('returns empty when atOnce has no date', () => {
    const dates = service.expandOccurrences({
      type: 'atOnce',
      date: null as any,
      recurring: null,
    });
    expect(dates).toHaveLength(0);
  });

  describe('UI Frequency card shape', () => {
    it('normalizes every / interval:"day" / repeatCount', () => {
      const normalized = service.normalizeSchedule({
        every: 1,
        interval: 'day',
        repeatCount: 5,
        daysOfWeek: [],
        monthMode: 'dayOfMonth',
        dayOfMonth: 1,
        weekOrder: 'first',
        onTheMonth: 'january',
        yearDay: 1,
        yearMonth: 'january',
      });
      expect(normalized).toEqual({
        interval: 1,
        unit: FrequencyUnit.DAY,
        repeat: 5,
      });
    });

    it('expands daily: every 1 day × 5 times (screenshot payload)', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-09-02',
        jobPosition: null,
        recurring: {
          every: 1,
          interval: 'day',
          repeatCount: 5,
          daysOfWeek: [],
          monthMode: 'dayOfMonth',
          dayOfMonth: 1,
          weekOrder: 'first',
          onTheMonth: 'january',
          yearDay: 1,
          yearMonth: 'january',
        },
      });
      expect(isoDates(dates)).toEqual([
        '2026-09-02',
        '2026-09-03',
        '2026-09-04',
        '2026-09-05',
        '2026-09-06',
      ]);
    });

    it('expands every 2 days × 3 times', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-09-01',
        recurring: { every: 2, interval: 'day', repeatCount: 3 },
      });
      expect(isoDates(dates)).toEqual(['2026-09-01', '2026-09-03', '2026-09-05']);
    });

    it('expands weekly without daysOfWeek as every N weeks from start', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-09-01',
        recurring: { every: 1, interval: 'week', repeatCount: 3, daysOfWeek: [] },
      });
      expect(isoDates(dates)).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
    });

    it('expands weekly with daysOfWeek (Mon/Wed) and COUNT', () => {
      // 2026-09-01 is Tuesday — first matches: Wed Sep 2, Mon Sep 7, Wed Sep 9, ...
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-09-01',
        recurring: {
          every: 1,
          interval: 'week',
          repeatCount: 4,
          daysOfWeek: ['monday', 'wednesday'],
        },
      });
      expect(isoDates(dates)).toEqual([
        '2026-09-02',
        '2026-09-07',
        '2026-09-09',
        '2026-09-14',
      ]);
    });

    it('expands every 2 weeks on Friday', () => {
      // 2026-09-04 is Friday; next biweekly Friday is 2026-09-18
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-09-04',
        recurring: {
          every: 2,
          interval: 'week',
          repeatCount: 3,
          daysOfWeek: ['friday'],
        },
      });
      expect(isoDates(dates)).toEqual(['2026-09-04', '2026-09-18', '2026-10-02']);
    });

    it('expands monthly dayOfMonth from UI flat fields', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-01-10',
        recurring: {
          every: 1,
          interval: 'month',
          repeatCount: 3,
          monthMode: 'dayOfMonth',
          dayOfMonth: 15,
        },
      });
      expect(isoDates(dates)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
    });

    it('expands monthly nthWeekday (onThe) from UI flat fields', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-01-01',
        recurring: {
          every: 1,
          interval: 'month',
          repeatCount: 2,
          monthMode: 'onThe',
          weekOrder: 'first',
          daysOfWeek: ['monday'],
        },
      });
      expect(dates).toHaveLength(2);
      expect(dates.every((d) => d.getUTCDay() === 1)).toBe(true);
      expect(dates[0].getUTCMonth()).toBe(0);
      expect(dates[1].getUTCMonth()).toBe(1);
    });

    it('expands yearly dayOfMonth (yearMonth + yearDay)', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-03-01',
        recurring: {
          every: 1,
          interval: 'year',
          repeatCount: 3,
          monthMode: 'dayOfMonth',
          yearMonth: 'january',
          yearDay: 15,
        },
      });
      expect(isoDates(dates)).toEqual(['2026-01-15', '2027-01-15', '2028-01-15']);
    });

    it('expands yearly nth weekday in onTheMonth', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-01-01',
        recurring: {
          every: 1,
          interval: 'year',
          repeatCount: 2,
          monthMode: 'onThe',
          weekOrder: 'second',
          daysOfWeek: ['tuesday'],
          onTheMonth: 'march',
        },
      });
      expect(dates).toHaveLength(2);
      expect(dates[0].getUTCMonth()).toBe(2);
      expect(dates[0].getUTCDay()).toBe(2);
      expect(dates[1].getUTCFullYear()).toBe(2027);
      expect(dates[1].getUTCMonth()).toBe(2);
    });

    it('treats repeat:true as open-ended up to maxOccurrences', () => {
      const dates = service.expandOccurrences(
        {
          type: 'recurring',
          date: '2026-01-01',
          recurring: { interval: 1, unit: 'day', repeat: true },
        },
        7,
      );
      expect(dates).toHaveLength(7);
      expect(isoDates(dates)[6]).toBe('2026-01-07');
    });

    it('accepts plural unit aliases from UI (Days / Weeks)', () => {
      expect(
        service.normalizeSchedule({ every: 1, interval: 'Days', repeatCount: 2 }),
      ).toMatchObject({ unit: FrequencyUnit.DAY, interval: 1, repeat: 2 });
      expect(
        service.normalizeSchedule({ every: 2, interval: 'weeks', repeatCount: 1 }),
      ).toMatchObject({ unit: FrequencyUnit.WEEK, interval: 2, repeat: 1 });
    });

    it('expands monthly On the Third weekday × 2 (screenshot intent)', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-01-01',
        recurring: {
          every: 1,
          interval: 'month',
          repeatCount: 2,
          monthMode: 'onThe',
          weekOrder: 'third',
          daysOfWeek: ['monday'],
          onTheMonth: 'march', // ignored for monthly unit
        },
      });
      expect(dates).toHaveLength(2);
      expect(dates.every((d) => d.getUTCDay() === 1)).toBe(true);
      // 3rd Monday Jan 2026 = Jan 19; 3rd Monday Feb 2026 = Feb 16
      expect(isoDates(dates)).toEqual(['2026-01-19', '2026-02-16']);
    });
  });

  describe('edge cases', () => {
    it('clamps dayOfMonth 31 in short months', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-01-01',
        recurring: {
          every: 1,
          interval: 'month',
          repeatCount: 3,
          monthMode: 'dayOfMonth',
          dayOfMonth: 31,
        },
      });
      expect(isoDates(dates)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    });

    it('supports nth weekday ordinals first/second/third/fourth/last', () => {
      // March 1, 2026 is Sunday → Mondays: 2, 9, 16, 23, 30
      const cases: Array<{ weekOrder: string; expectedDay: number }> = [
        { weekOrder: 'first', expectedDay: 2 },
        { weekOrder: 'second', expectedDay: 9 },
        { weekOrder: 'third', expectedDay: 16 },
        { weekOrder: 'fourth', expectedDay: 23 },
        { weekOrder: 'last', expectedDay: 30 },
      ];
      for (const { weekOrder, expectedDay } of cases) {
        const dates = service.expandOccurrences({
          type: 'recurring',
          date: '2026-03-01',
          recurring: {
            every: 1,
            interval: 'month',
            repeatCount: 1,
            monthMode: 'onThe',
            weekOrder,
            daysOfWeek: ['monday'],
          },
        });
        expect(isoDates(dates)).toEqual([`2026-03-${String(expectedDay).padStart(2, '0')}`]);
      }
    });

    it('clamps yearly Feb 29 to Feb 28 in non-leap years', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2024-02-01',
        recurring: {
          every: 1,
          interval: 'year',
          repeatCount: 3,
          monthMode: 'dayOfMonth',
          yearMonth: 'february',
          yearDay: 29,
        },
      });
      expect(isoDates(dates)).toEqual(['2024-02-29', '2025-02-28', '2026-02-28']);
    });

    it('stops early when endDate is set', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-09-01',
        endDate: '2026-09-03',
        recurring: { every: 1, interval: 'day', repeatCount: 10 },
      });
      expect(isoDates(dates)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    });

    it('clamps repeatCount above default maxOccurrences (100)', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-01-01',
        recurring: { every: 1, interval: 'day', repeatCount: 250 },
      });
      expect(dates).toHaveLength(100);
    });

    it('defaults weekday to monday when monthly onThe has no daysOfWeek', () => {
      const normalized = service.normalizeSchedule({
        every: 1,
        interval: 'month',
        repeatCount: 1,
        monthMode: 'onThe',
        weekOrder: 'third',
        onTheMonth: 'march',
        daysOfWeek: [],
      });
      expect(normalized.monthlyRule).toEqual({
        type: MonthlyRuleType.NTH_WEEKDAY,
        ordinal: 'third',
        weekday: 'monday',
      });
    });
  });
});
