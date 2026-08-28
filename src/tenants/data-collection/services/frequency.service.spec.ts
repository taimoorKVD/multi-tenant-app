import { FrequencyService } from './frequency.service';
import { FrequencyType, FrequencyUnit, MonthlyRuleType, WeekdayOrdinal } from '../entities/enums';

describe('FrequencyService', () => {
  const service = new FrequencyService();

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
});
