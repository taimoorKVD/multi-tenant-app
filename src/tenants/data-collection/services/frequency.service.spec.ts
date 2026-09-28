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

    it('treats repeat:true as open-ended for the next 12 months', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-01-01',
        recurring: { interval: 1, unit: 'day', repeat: true },
      });
      expect(dates).toHaveLength(365);
      expect(isoDates(dates)[dates.length - 1]).toBe('2026-12-31');
    });

    it('accepts plural unit aliases from UI (Days / Weeks)', () => {
      expect(
        service.normalizeSchedule({ every: 1, interval: 'Days', repeatCount: 2 }),
      ).toMatchObject({ unit: FrequencyUnit.DAY, interval: 1, repeat: 2 });
      expect(
        service.normalizeSchedule({ every: 2, interval: 'weeks', repeatCount: 3 }),
      ).toMatchObject({ unit: FrequencyUnit.WEEK, interval: 2, repeat: 3 });
    });

    it('treats UI default repeatCount:1 as a 12-month daily schedule', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-09-17',
        recurring: {
          every: 1,
          interval: 'day',
          repeatCount: 1,
          daysOfWeek: [],
          monthMode: 'dayOfMonth',
          dayOfMonth: 1,
          weekOrder: 'first',
          onTheMonth: 'january',
          yearDay: 1,
          yearMonth: 'january',
        },
      });
      expect(dates).toHaveLength(365);
      expect(isoDates(dates)[dates.length - 1]).toBe('2027-09-16');
    });

    it('honors explicit ends:never as open-ended', () => {
      const normalized = service.normalizeSchedule(
        { every: 1, interval: 'day', ends: 'never' },
        10,
      );
      expect(normalized.repeat).toBe(10);
    });

    it('uses canonical repeat:1 for a finite single occurrence', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-09-17',
        recurring: { interval: 1, unit: 'day', repeat: 1 },
      });
      expect(isoDates(dates)).toEqual(['2026-09-17']);
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
            // Canonical repeat:1 keeps a single occurrence (UI repeatCount:1 is open-ended).
            repeat: 1,
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

    it('when endDate is set, expands through the window even if repeatCount is smaller', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        startDate: '2026-09-27',
        endDate: '2026-10-01',
        every: 2,
        interval: 'day',
        repeatCount: 2,
        times: ['01:00', '05:00'],
      });
      expect(dates.map((d) => d.toISOString())).toEqual([
        '2026-09-27T01:00:00.000Z',
        '2026-09-27T05:00:00.000Z',
        '2026-09-29T01:00:00.000Z',
        '2026-09-29T05:00:00.000Z',
        '2026-10-01T01:00:00.000Z',
        '2026-10-01T05:00:00.000Z',
      ]);
    });

    it('does not clamp an explicit finite repeatCount to 100', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: '2026-01-01',
        recurring: { every: 1, interval: 'day', repeatCount: 250 },
      });
      expect(dates).toHaveLength(250);
    });

    it('defaults weekday to monday when monthly onThe has no daysOfWeek', () => {
      const normalized = service.normalizeSchedule({
        every: 1,
        interval: 'month',
        repeat: 1,
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

  describe('all frequency type cases (matrix)', () => {
    describe('type: atOnce / one-time aliases', () => {
      it.each([
        ['atOnce'],
        ['atonce'],
        ['at_once'],
        ['one_time'],
        ['one-time'],
        [FrequencyType.AT_ONCE],
        [FrequencyType.ONE_TIME],
      ])('accepts type=%s as a single occurrence', (type) => {
        const dates = service.expandOccurrences({
          type,
          date: '2026-08-21',
          recurring: null,
        });
        expect(isoDates(dates)).toEqual(['2026-08-21']);
      });

      it('returns empty when start is after endDate', () => {
        const dates = service.expandOccurrences({
          type: 'atOnce',
          date: '2026-08-21',
          endDate: '2026-08-01',
          recurring: null,
        });
        expect(dates).toHaveLength(0);
      });

      it('returns empty for null frequency', () => {
        expect(service.expandOccurrences(null)).toEqual([]);
        expect(service.expandOccurrences(undefined)).toEqual([]);
      });
    });

    describe('type: recurring — day', () => {
      it('canonical every N days', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-09-01',
              recurring: { interval: 3, unit: FrequencyUnit.DAY, repeat: 3 },
            }),
          ),
        ).toEqual(['2026-09-01', '2026-09-04', '2026-09-07']);
      });

      it('UI every 1 day × finite repeatCount', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-09-10',
              recurring: { every: 1, interval: 'day', repeatCount: 3 },
            }),
          ),
        ).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
      });

      it('UI repeatCount:1 creates daily occurrences for 12 months', () => {
        const dates = service.expandOccurrences({
          type: 'recurring',
          date: '2026-09-17',
          recurring: { every: 1, interval: 'day', repeatCount: 1 },
        });
        expect(dates).toHaveLength(365);
        expect(isoDates(dates)[dates.length - 1]).toBe('2027-09-16');
      });

      it('accepts daily / Days aliases', () => {
        expect(
          service.normalizeSchedule({ every: 1, interval: 'daily', repeatCount: 2 }),
        ).toMatchObject({ unit: FrequencyUnit.DAY, interval: 1, repeat: 2 });
        expect(
          service.normalizeSchedule({ every: 2, interval: 'Days', repeatCount: 2 }),
        ).toMatchObject({ unit: FrequencyUnit.DAY, interval: 2, repeat: 2 });
      });
    });

    describe('type: recurring — week', () => {
      it('canonical every N weeks from start (no weekdays)', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-09-01',
              recurring: { interval: 2, unit: FrequencyUnit.WEEK, repeat: 3 },
            }),
          ),
        ).toEqual(['2026-09-01', '2026-09-15', '2026-09-29']);
      });

      it('UI weekly without daysOfWeek', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-09-01',
              recurring: { every: 1, interval: 'week', repeatCount: 3, daysOfWeek: [] },
            }),
          ),
        ).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
      });

      it('UI weekly with selected days (short names)', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-09-01',
              recurring: {
                every: 1,
                interval: 'week',
                repeatCount: 3,
                daysOfWeek: ['mon', 'wed'],
              },
            }),
          ),
        ).toEqual(['2026-09-02', '2026-09-07', '2026-09-09']);
      });

      it('UI biweekly Friday', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-09-04',
              recurring: {
                every: 2,
                interval: 'week',
                repeatCount: 3,
                daysOfWeek: ['friday'],
              },
            }),
          ),
        ).toEqual(['2026-09-04', '2026-09-18', '2026-10-02']);
      });

      it('UI weekly repeatCount:1 is open-ended with daysOfWeek', () => {
        const dates = service.expandOccurrences({
          type: 'recurring',
          date: '2026-09-01',
          recurring: {
            every: 1,
            interval: 'week',
            repeatCount: 1,
            daysOfWeek: ['monday'],
          },
        });
        expect(dates).toHaveLength(52);
        expect(isoDates(dates)[dates.length - 1]).toBe('2027-08-30');
      });

      it('accepts weekly / Weeks aliases', () => {
        expect(
          service.normalizeSchedule({ every: 1, interval: 'weekly', repeatCount: 2 }),
        ).toMatchObject({ unit: FrequencyUnit.WEEK, interval: 1, repeat: 2 });
      });
    });

    describe('type: recurring — month', () => {
      it('canonical day-of-month rule', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-01-15',
              recurring: {
                interval: 1,
                unit: FrequencyUnit.MONTH,
                repeat: 3,
                monthlyRule: { type: MonthlyRuleType.DAY_OF_MONTH, day: 1 },
              },
            }),
          ),
        ).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
      });

      it('UI monthMode dayOfMonth', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-01-10',
              recurring: {
                every: 1,
                interval: 'month',
                repeatCount: 3,
                monthMode: 'dayOfMonth',
                dayOfMonth: 15,
              },
            }),
          ),
        ).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
      });

      it('UI every 2 months on day 10', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-01-01',
              recurring: {
                every: 2,
                interval: 'month',
                repeatCount: 3,
                monthMode: 'dayOfMonth',
                dayOfMonth: 10,
              },
            }),
          ),
        ).toEqual(['2026-01-10', '2026-03-10', '2026-05-10']);
      });

      it('UI monthMode onThe (nth weekday)', () => {
        expect(
          isoDates(
            service.expandOccurrences({
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
            }),
          ),
        ).toEqual(['2026-01-05', '2026-02-02']);
      });

      it('UI monthly repeatCount:1 is open-ended', () => {
        const dates = service.expandOccurrences({
          type: 'recurring',
          date: '2026-01-15',
          recurring: {
            every: 1,
            interval: 'month',
            repeatCount: 1,
            monthMode: 'dayOfMonth',
            dayOfMonth: 15,
          },
        });
        expect(dates).toHaveLength(12);
        expect(isoDates(dates)[dates.length - 1]).toBe('2026-12-15');
      });

      it('last day of month via day=-1', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-01-01',
              recurring: {
                interval: 1,
                unit: FrequencyUnit.MONTH,
                repeat: 2,
                monthlyRule: { type: MonthlyRuleType.DAY_OF_MONTH, day: -1 },
              },
            }),
          ),
        ).toEqual(['2026-01-31', '2026-02-28']);
      });

      it('accepts monthly / Months aliases', () => {
        expect(
          service.normalizeSchedule({ every: 1, interval: 'monthly', repeatCount: 2 }),
        ).toMatchObject({ unit: FrequencyUnit.MONTH, interval: 1, repeat: 2 });
        expect(
          service.normalizeSchedule({ every: 1, interval: 'Months', repeatCount: 2 }),
        ).toMatchObject({ unit: FrequencyUnit.MONTH, interval: 1, repeat: 2 });
      });
    });

    describe('type: recurring — year', () => {
      it('canonical every N years', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-06-01',
              recurring: { interval: 1, unit: FrequencyUnit.YEAR, repeat: 3 },
            }),
          ),
        ).toEqual(['2026-06-01', '2027-06-01', '2028-06-01']);
      });

      it('UI yearly dayOfMonth (yearMonth + yearDay)', () => {
        expect(
          isoDates(
            service.expandOccurrences({
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
            }),
          ),
        ).toEqual(['2026-01-15', '2027-01-15', '2028-01-15']);
      });

      it('UI yearly onThe nth weekday in onTheMonth', () => {
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
      });

      it('UI yearly repeatCount:1 is open-ended', () => {
        const dates = service.expandOccurrences({
          type: 'recurring',
          date: '2026-01-01',
          recurring: {
            every: 1,
            interval: 'year',
            repeatCount: 1,
            monthMode: 'dayOfMonth',
            yearMonth: 'june',
            yearDay: 1,
          },
        });
        expect(isoDates(dates)).toEqual(['2026-06-01']);
      });

      it('accepts yearly / annually aliases', () => {
        expect(
          service.normalizeSchedule({ every: 1, interval: 'yearly', repeatCount: 2 }),
        ).toMatchObject({ unit: FrequencyUnit.YEAR, interval: 1, repeat: 2 });
        expect(
          service.normalizeSchedule({ every: 1, interval: 'annually', repeatCount: 2 }),
        ).toMatchObject({ unit: FrequencyUnit.YEAR, interval: 1, repeat: 2 });
      });
    });

    describe('open-ended / ends controls', () => {
      it('ends:never and endType:never → maxOccurrences', () => {
        expect(
          service.normalizeSchedule({ every: 1, interval: 'day', ends: 'never' }, 12).repeat,
        ).toBe(12);
        expect(
          service.normalizeSchedule({ every: 1, interval: 'day', endType: 'never' }, 8).repeat,
        ).toBe(8);
      });

      it('omitted repeat/repeatCount → open-ended', () => {
        expect(
          service.normalizeSchedule({ every: 1, interval: 'day' }, 5).repeat,
        ).toBe(5);
      });

      it('canonical repeat:1 stays finite (not UI repeatCount)', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-09-17',
              recurring: { interval: 1, unit: 'day', repeat: 1 },
            }),
          ),
        ).toEqual(['2026-09-17']);
      });

      it('recurring with no schedule object returns start only', () => {
        expect(
          isoDates(
            service.expandOccurrences({
              type: 'recurring',
              date: '2026-09-17',
              recurring: null,
            }),
          ),
        ).toEqual(['2026-09-17']);
      });
    });
  });

  describe('flat UI payload + time / times', () => {
    it('interprets wall-clock times in tenant timezone (Asia/Karachi)', () => {
      // 2:56 PM Pakistan = 14:56 local = 09:56 UTC
      const dates = service.expandOccurrences(
        {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          recurring: {
            every: 1,
            interval: 'day',
            repeatCount: 1,
            times: ['14:56'],
          },
        },
        undefined,
        'Asia/Karachi',
      );
      expect(dates.map((d) => d.toISOString())).toEqual(['2026-09-28T09:56:00.000Z']);
      expect(service.formatDateTimeAmPm(dates[0], 'Asia/Karachi')).toBe('Sep 28, 2026, 2:56 PM');
      expect(service.buildDueTimeFields(dates[0], 'Asia/Karachi')).toEqual({
        hasDueTime: true,
        dueTime: '14:56',
        dueTimeAmPm: '2:56 PM',
        dueTimeParts: { hour: '02', minute: '56', period: 'PM' },
      });
    });

    it('prefers tenant timezone override; defaults to UTC when unset', () => {
      const dates = service.expandOccurrences(
        {
          type: 'atOnce',
          date: '2026-09-28',
          time: '14:56',
        },
        undefined,
        'Asia/Karachi',
      );
      expect(dates.map((d) => d.toISOString())).toEqual(['2026-09-28T09:56:00.000Z']);
      expect(service.buildDueTimeFields(dates[0], 'Asia/Karachi')).toEqual({
        hasDueTime: true,
        dueTime: '14:56',
        dueTimeAmPm: '2:56 PM',
        dueTimeParts: { hour: '02', minute: '56', period: 'PM' },
      });
      expect(service.getFrequencyTimeZone('America/New_York')).toBe('America/New_York');
      expect(service.getFrequencyTimeZone('Not/AZone')).toBe('UTC');
      expect(service.getFrequencyTimeZone(null)).toBe('UTC');

      const utcDates = service.expandOccurrences({
        type: 'atOnce',
        date: '2026-09-28',
        time: '14:56',
      });
      expect(utcDates.map((d) => d.toISOString())).toEqual(['2026-09-28T14:56:00.000Z']);
    });

    it('atOnce with 24h time materializes that UTC clock (15:06 → 3:06 PM)', () => {
      const dates = service.expandOccurrences({
        type: 'atOnce',
        date: '2026-09-26',
        time: '15:06',
        startDate: null,
        endDate: null,
        every: 1,
        interval: 'month',
        repeatCount: 1,
        monthMode: 'dayOfMonth',
        dayOfMonth: 1,
        weekOrder: 'first',
        onTheMonth: 'january',
        daysOfWeek: [],
        yearMonth: 'january',
        yearDay: 1,
        times: [],
      });
      expect(dates).toHaveLength(1);
      expect(dates[0].toISOString()).toBe('2026-09-26T15:06:00.000Z');
      expect(service.formatTimeAmPm(15, 6)).toBe('3:06 PM');
      expect(service.formatDateTimeAmPm(dates[0])).toBe('Sep 26, 2026, 3:06 PM');
      expect(service.formatFrequencyLabel({
        type: 'atOnce',
        date: '2026-09-26',
        time: '15:06',
      })).toBe('Once · Sep 26, 2026, 3:06 PM');
    });

    it('parses AM/PM time strings', () => {
      expect(service.parseClockTime('3:06 PM')).toEqual({ hours: 15, minutes: 6 });
      expect(service.parseClockTime('12:00 AM')).toEqual({ hours: 0, minutes: 0 });
      expect(service.parseClockTime('12:00 PM')).toEqual({ hours: 12, minutes: 0 });
    });

    it('enriches 24h time for edit UI (22:33 → 10:33 PM parts)', () => {
      const enriched = service.enrichFrequencyForUi({
        type: 'atOnce',
        date: '2026-09-25',
        time: '22:33',
      });
      expect(enriched).toMatchObject({
        time: '22:33',
        timeAmPm: '10:33 PM',
        timeParts: { hour: '10', minute: '33', period: 'PM' },
      });
    });

    it('daily flat: startDate→endDate × times', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: null,
        time: null,
        startDate: '2026-09-27',
        endDate: '2026-10-01',
        every: 2,
        interval: 'day',
        repeatCount: 2,
        monthMode: 'dayOfMonth',
        dayOfMonth: 1,
        weekOrder: 'first',
        onTheMonth: 'january',
        daysOfWeek: [],
        yearMonth: 'january',
        yearDay: 1,
        times: ['01:00', '05:00'],
      });
      expect(dates.map((d) => d.toISOString())).toEqual([
        '2026-09-27T01:00:00.000Z',
        '2026-09-27T05:00:00.000Z',
        '2026-09-29T01:00:00.000Z',
        '2026-09-29T05:00:00.000Z',
        '2026-10-01T01:00:00.000Z',
        '2026-10-01T05:00:00.000Z',
      ]);
    });

    it('weekly flat: daysOfWeek within startDate→endDate with single time', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        startDate: '2026-09-21', // Monday
        endDate: '2026-10-02',
        every: 1,
        interval: 'week',
        repeatCount: 1,
        daysOfWeek: ['monday', 'wednesday'],
        time: '09:30',
        times: [],
      });
      expect(dates.map((d) => d.toISOString())).toEqual([
        '2026-09-21T09:30:00.000Z',
        '2026-09-23T09:30:00.000Z',
        '2026-09-28T09:30:00.000Z',
        '2026-09-30T09:30:00.000Z',
      ]);
    });

    it('monthly flat: dayOfMonth within startDate→endDate with times', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        every: 1,
        interval: 'month',
        repeatCount: 2,
        monthMode: 'dayOfMonth',
        dayOfMonth: 15,
        times: ['08:00', '14:00'],
      });
      expect(dates.map((d) => d.toISOString())).toEqual([
        '2026-01-15T08:00:00.000Z',
        '2026-01-15T14:00:00.000Z',
        '2026-02-15T08:00:00.000Z',
        '2026-02-15T14:00:00.000Z',
        '2026-03-15T08:00:00.000Z',
        '2026-03-15T14:00:00.000Z',
      ]);
    });

    it('yearly flat: yearMonth/yearDay within startDate→endDate with time', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        startDate: '2026-01-01',
        endDate: '2028-12-31',
        every: 1,
        interval: 'year',
        repeatCount: 1,
        monthMode: 'dayOfMonth',
        yearMonth: 'january',
        yearDay: 1,
        time: '10:00',
        times: [],
      });
      expect(dates.map((d) => d.toISOString())).toEqual([
        '2026-01-01T10:00:00.000Z',
        '2027-01-01T10:00:00.000Z',
        '2028-01-01T10:00:00.000Z',
      ]);
    });

    it('recurring with repeatCount:1 still applies times[]', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        startDate: '2026-09-27',
        endDate: '2026-09-28',
        every: 1,
        interval: 'day',
        repeatCount: 1,
        times: ['09:00'],
      });
      expect(dates.map((d) => d.toISOString())).toEqual([
        '2026-09-27T09:00:00.000Z',
        '2026-09-28T09:00:00.000Z',
      ]);
    });

    it('prefers times[] over singular time', () => {
      const dates = service.expandOccurrences({
        type: 'atOnce',
        date: '2026-09-26',
        time: '15:06',
        times: ['01:00', '05:00'],
      });
      expect(dates.map((d) => d.toISOString())).toEqual([
        '2026-09-26T01:00:00.000Z',
        '2026-09-26T05:00:00.000Z',
      ]);
    });

    it('reads times from nested recurring (monthly screenshot payload)', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        date: null,
        time: null,
        startDate: '2026-09-25',
        endDate: '2026-10-01',
        jobPosition: null,
        recurring: {
          time: null,
          every: 1,
          times: ['12:04'],
          yearDay: 1,
          interval: 'month',
          monthMode: 'dayOfMonth',
          weekOrder: 'first',
          yearMonth: 'january',
          dayOfMonth: 1,
          daysOfWeek: [],
          onTheMonth: 'january',
          repeatCount: 1,
        },
      });
      // dayOfMonth:1 with start mid-month skips Sep 1; Oct 1 is in window at 12:04.
      expect(dates.map((d) => d.toISOString())).toEqual(['2026-10-01T12:04:00.000Z']);
    });

    it('nested weekly: Tue/Sat × times within startDate→endDate', () => {
      // 2026-09-25 = Friday → Sat 26, Tue 29, Sat Oct 3 (inclusive)
      const dates = service.expandOccurrences({
        date: null,
        time: null,
        type: 'recurring',
        endDate: '2026-10-03',
        startDate: '2026-09-25',
        jobPosition: null,
        recurring: {
          time: null,
          every: 1,
          times: ['20:13', '11:09'],
          yearDay: 1,
          interval: 'week',
          monthMode: 'dayOfMonth',
          weekOrder: 'first',
          yearMonth: 'january',
          dayOfMonth: 1,
          daysOfWeek: ['tuesday', 'saturday'],
          onTheMonth: 'january',
          repeatCount: 2,
        },
      });
      expect(dates.map((d) => d.toISOString())).toEqual([
        '2026-09-26T11:09:00.000Z',
        '2026-09-26T20:13:00.000Z',
        '2026-09-29T11:09:00.000Z',
        '2026-09-29T20:13:00.000Z',
        '2026-10-03T11:09:00.000Z',
        '2026-10-03T20:13:00.000Z',
      ]);
    });

    it('nested yearly: Sep 25 × times within startDate→endDate', () => {
      // Only 2026-09-25 falls in [2026-09-25, 2027-01-01]; 2027-09-25 is after endDate.
      const dates = service.expandOccurrences({
        date: '2026-09-25',
        time: null,
        type: 'recurring',
        endDate: '2027-01-01',
        startDate: '2026-09-25',
        jobPosition: null,
        recurring: {
          time: null,
          every: 1,
          times: ['17:11', '03:13'],
          yearDay: 25,
          interval: 'year',
          monthMode: 'dayOfMonth',
          weekOrder: 'first',
          yearMonth: 'september',
          dayOfMonth: 1,
          daysOfWeek: [],
          onTheMonth: 'january',
          repeatCount: 2,
        },
      });
      expect(dates.map((d) => d.toISOString())).toEqual([
        '2026-09-25T03:13:00.000Z',
        '2026-09-25T17:11:00.000Z',
      ]);
    });

    it('nested recurring times — daily / weekly / yearly', () => {
      expect(
        service
          .expandOccurrences({
            type: 'recurring',
            startDate: '2026-09-27',
            endDate: '2026-09-29',
            recurring: {
              every: 1,
              interval: 'day',
              repeatCount: 1,
              times: ['08:15', '20:00'],
            },
          })
          .map((d) => d.toISOString()),
      ).toEqual([
        '2026-09-27T08:15:00.000Z',
        '2026-09-27T20:00:00.000Z',
        '2026-09-28T08:15:00.000Z',
        '2026-09-28T20:00:00.000Z',
        '2026-09-29T08:15:00.000Z',
        '2026-09-29T20:00:00.000Z',
      ]);

      expect(
        service
          .expandOccurrences({
            type: 'recurring',
            startDate: '2026-09-21',
            endDate: '2026-09-23',
            recurring: {
              every: 1,
              interval: 'week',
              repeatCount: 1,
              daysOfWeek: ['monday', 'wednesday'],
              times: ['09:00'],
            },
          })
          .map((d) => d.toISOString()),
      ).toEqual(['2026-09-21T09:00:00.000Z', '2026-09-23T09:00:00.000Z']);

      expect(
        service
          .expandOccurrences({
            type: 'recurring',
            startDate: '2026-01-01',
            endDate: '2027-12-31',
            recurring: {
              every: 1,
              interval: 'year',
              repeatCount: 1,
              monthMode: 'dayOfMonth',
              yearMonth: 'january',
              yearDay: 1,
              times: ['10:00'],
            },
          })
          .map((d) => d.toISOString()),
      ).toEqual(['2026-01-01T10:00:00.000Z', '2027-01-01T10:00:00.000Z']);
    });

    it('enriches nested recurring.times for edit UI', () => {
      const enriched = service.enrichFrequencyForUi({
        type: 'recurring',
        time: null,
        startDate: '2026-09-25',
        endDate: '2026-10-01',
        recurring: {
          every: 1,
          interval: 'month',
          repeatCount: 1,
          times: ['12:04'],
          monthMode: 'dayOfMonth',
          dayOfMonth: 1,
        },
      });
      expect(enriched).toMatchObject({
        timesAmPm: ['12:04 PM'],
        timesParts: [{ hour: '12', minute: '04', period: 'PM' }],
        recurring: {
          times: ['12:04'],
          timesAmPm: ['12:04 PM'],
          timesParts: [{ hour: '12', minute: '04', period: 'PM' }],
        },
      });
    });

    it('root times take precedence over nested recurring.times', () => {
      const dates = service.expandOccurrences({
        type: 'recurring',
        startDate: '2026-09-27',
        endDate: '2026-09-27',
        times: ['01:00'],
        recurring: {
          every: 1,
          interval: 'day',
          repeatCount: 1,
          times: ['12:04'],
        },
      });
      expect(dates.map((d) => d.toISOString())).toEqual(['2026-09-27T01:00:00.000Z']);
    });
  });

  describe('all frequency types with tenant timezone selected', () => {
    // 14:56 Asia/Karachi (UTC+5) → 09:56Z; 14:56 America/New_York (EDT UTC-4 on 2026-09-28) → 18:56Z
    const cases: Array<{
      label: string;
      timeZone: string;
      localTime: string;
      expectedIso: string;
      frequency: Record<string, unknown>;
    }> = [
      {
        label: 'atOnce',
        timeZone: 'Asia/Karachi',
        localTime: '14:56',
        expectedIso: '2026-09-28T09:56:00.000Z',
        frequency: { type: 'atOnce', date: '2026-09-28', time: '14:56' },
      },
      {
        label: 'daily',
        timeZone: 'Asia/Karachi',
        localTime: '14:56',
        expectedIso: '2026-09-28T09:56:00.000Z',
        frequency: {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          recurring: { every: 1, interval: 'day', repeatCount: 1, times: ['14:56'] },
        },
      },
      {
        label: 'weekly (Mon)',
        timeZone: 'Asia/Karachi',
        localTime: '14:56',
        expectedIso: '2026-09-28T09:56:00.000Z', // 2026-09-28 is Monday
        frequency: {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          recurring: {
            every: 1,
            interval: 'week',
            repeatCount: 1,
            daysOfWeek: ['monday'],
            times: ['14:56'],
          },
        },
      },
      {
        label: 'monthly dayOfMonth',
        timeZone: 'Asia/Karachi',
        localTime: '14:56',
        expectedIso: '2026-09-28T09:56:00.000Z',
        frequency: {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          recurring: {
            every: 1,
            interval: 'month',
            repeatCount: 1,
            monthMode: 'dayOfMonth',
            dayOfMonth: 28,
            times: ['14:56'],
          },
        },
      },
      {
        label: 'yearly',
        timeZone: 'Asia/Karachi',
        localTime: '14:56',
        expectedIso: '2026-09-28T09:56:00.000Z',
        frequency: {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          recurring: {
            every: 1,
            interval: 'year',
            repeatCount: 1,
            yearMonth: 'september',
            yearDay: 28,
            times: ['14:56'],
          },
        },
      },
      {
        label: 'atOnce America/New_York',
        timeZone: 'America/New_York',
        localTime: '14:56',
        expectedIso: '2026-09-28T18:56:00.000Z',
        frequency: { type: 'atOnce', date: '2026-09-28', time: '14:56' },
      },
      {
        label: 'daily America/New_York',
        timeZone: 'America/New_York',
        localTime: '14:56',
        expectedIso: '2026-09-28T18:56:00.000Z',
        frequency: {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          times: ['14:56'],
          every: 1,
          interval: 'day',
          repeatCount: 1,
        },
      },
      {
        label: 'weekly America/New_York',
        timeZone: 'America/New_York',
        localTime: '09:00',
        expectedIso: '2026-09-28T13:00:00.000Z',
        frequency: {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          recurring: {
            every: 1,
            interval: 'week',
            daysOfWeek: ['monday'],
            times: ['09:00'],
          },
        },
      },
      {
        label: 'monthly Europe/London (BST)',
        timeZone: 'Europe/London',
        localTime: '14:56',
        expectedIso: '2026-09-28T13:56:00.000Z', // BST = UTC+1 in September
        frequency: {
          type: 'recurring',
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          recurring: {
            every: 1,
            interval: 'month',
            monthMode: 'dayOfMonth',
            dayOfMonth: 28,
            times: ['14:56'],
          },
        },
      },
      {
        label: 'multi times daily Asia/Karachi',
        timeZone: 'Asia/Karachi',
        localTime: '09:00,17:30',
        expectedIso: '2026-09-28T04:00:00.000Z,2026-09-28T12:30:00.000Z',
        frequency: {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          recurring: {
            every: 1,
            interval: 'day',
            times: ['09:00', '17:30'],
          },
        },
      },
    ];

    it.each(cases)(
      '$label → wall-clock $localTime in $timeZone',
      ({ timeZone, localTime, expectedIso, frequency }) => {
        const dates = service.expandOccurrences(frequency as any, undefined, timeZone);
        expect(dates.map((d) => d.toISOString())).toEqual(expectedIso.split(','));

        for (let i = 0; i < dates.length; i++) {
          const expectedLocal = localTime.split(',')[i];
          const fields = service.buildDueTimeFields(dates[i], timeZone);
          expect(fields.hasDueTime).toBe(true);
          expect(fields.dueTime).toBe(expectedLocal);
        }
      },
    );

    it('unset tenant timezone keeps UTC wall-clock for all types', () => {
      const payloads = [
        { type: 'atOnce', date: '2026-09-28', time: '14:56' },
        {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          recurring: { every: 1, interval: 'day', times: ['14:56'] },
        },
        {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          recurring: {
            every: 1,
            interval: 'week',
            daysOfWeek: ['monday'],
            times: ['14:56'],
          },
        },
        {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          recurring: {
            every: 1,
            interval: 'month',
            monthMode: 'dayOfMonth',
            dayOfMonth: 28,
            times: ['14:56'],
          },
        },
        {
          type: 'recurring',
          startDate: '2026-09-28',
          endDate: '2026-09-28',
          recurring: {
            every: 1,
            interval: 'year',
            yearMonth: 'september',
            yearDay: 28,
            times: ['14:56'],
          },
        },
      ];

      for (const frequency of payloads) {
        const dates = service.expandOccurrences(frequency as any);
        expect(dates.map((d) => d.toISOString())).toEqual(['2026-09-28T14:56:00.000Z']);
        expect(service.buildDueTimeFields(dates[0])).toEqual({
          hasDueTime: true,
          dueTime: '14:56',
          dueTimeAmPm: '2:56 PM',
          dueTimeParts: { hour: '02', minute: '56', period: 'PM' },
        });
      }
    });
  });
});

describe('FrequencyService.formatFrequencyLabel', () => {
  const service = new FrequencyService();

  it('formats yearly, monthly, daily, and once labels', () => {
    expect(
      service.formatFrequencyLabel({
        type: 'recurring',
        date: '2026-01-01',
        recurring: { every: 1, interval: 'year', repeatCount: 100 },
      }),
    ).toBe('Yearly · Jan 1');

    expect(
      service.formatFrequencyLabel({
        type: 'recurring',
        date: '2026-09-01',
        recurring: {
          every: 1,
          interval: 'month',
          repeatCount: 12,
          monthMode: 'dayOfMonth',
          dayOfMonth: 1,
        },
      }),
    ).toBe('Monthly · 1st');

    expect(
      service.formatFrequencyLabel({
        type: 'recurring',
        date: '2026-09-23',
        recurring: { every: 1, interval: 'day', repeatCount: 1 },
      }),
    ).toBe('Daily');

    expect(
      service.formatFrequencyLabel({
        type: 'atOnce',
        date: '2026-09-15',
        recurring: null,
      }),
    ).toBe('Once · Sep 15, 2026');
  });
});
