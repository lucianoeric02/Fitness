import { describe, expect, it } from 'vitest';
import { addDays, ageOn, dayRange, daysBetween, formatDayKey, isDayKey, startOfWeek, toDayKey } from './dates';

describe('dates', () => {
  it('formats local dates as DayKeys', () => {
    expect(formatDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('applies the day-start hour for late-night entries', () => {
    const lateNight = new Date(2026, 10, 26, 1, 30);
    expect(toDayKey(lateNight, 0)).toBe('2026-11-26');
    expect(toDayKey(lateNight, 3)).toBe('2026-11-25');
    expect(toDayKey(new Date(2026, 10, 26, 3, 0), 3)).toBe('2026-11-26');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('counts days between keys', () => {
    expect(daysBetween('2026-11-01', '2026-11-25')).toBe(24);
    expect(daysBetween('2026-11-25', '2026-11-01')).toBe(-24);
  });

  it('finds the start of the week', () => {
    // 2026-11-25 is a Wednesday
    expect(startOfWeek('2026-11-25', 1)).toBe('2026-11-23');
    expect(startOfWeek('2026-11-25', 0)).toBe('2026-11-22');
    expect(startOfWeek('2026-11-23', 1)).toBe('2026-11-23');
  });

  it('builds inclusive ranges', () => {
    expect(dayRange('2026-11-29', '2026-12-02')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
    expect(dayRange('2026-12-02', '2026-11-29')).toEqual([]);
  });

  it('validates DayKeys strictly', () => {
    expect(isDayKey('2026-02-28')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-2-3')).toBe(false);
    expect(isDayKey(20261125)).toBe(false);
  });

  it('computes age', () => {
    expect(ageOn('2000-11-26', '2026-11-25')).toBe(25);
    expect(ageOn('2000-11-25', '2026-11-25')).toBe(26);
  });
});
