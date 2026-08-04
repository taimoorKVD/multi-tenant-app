import { FrequencyService } from './frequency.service';
import { FrequencyType, FrequencyUnit, MonthlyRuleType, WeekdayOrdinal } from '../entities/enums';

describe('FrequencyService', () => {
  const service = new FrequencyService();

  it('expands one_time to a single date', () => {
    const dates = service.expandOccurrences({
      type: FrequencyType.ONE_TIME,
      startDate: '2026-07-17',
    });
    expect(dates).toHaveLength(1);
    expect(dates[0].toISOString().startsWith('2026-07-17')).toBe(true);
  });

  it('expands recurring monthly On day 1', () => {
    const dates = service.expandOccurrences({
      type: FrequencyType.RECURRING,
      startDate: '2026-01-15',
      schedule: {
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
      startDate: '2026-02-01',
      schedule: {
        interval: 1,
        unit: FrequencyUnit.MONTH,
        repeat: 1,
        monthlyRule: { type: MonthlyRuleType.DAY_OF_MONTH, day: -1 },
      },
    });
    expect(dates).toHaveLength(1);
    expect(dates[0].getUTCDate()).toBe(28);
  });

  it('supports nth weekday rule', () => {
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
});
