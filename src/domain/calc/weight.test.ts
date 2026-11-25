import { describe, expect, it } from 'vitest';
import { dailyWeights, movingAverage, summarizeWeights, weeklyRate } from './weight';
import { addDays } from '@/lib/dates';

describe('weight trends', () => {
  it('averages multiple weigh-ins per day and sorts', () => {
    const d = dailyWeights([
      { day: '2026-11-02', weightKg: 80 },
      { day: '2026-11-01', weightKg: 79 },
      { day: '2026-11-02', weightKg: 81 },
    ]);
    expect(d).toEqual([
      { day: '2026-11-01', weightKg: 79 },
      { day: '2026-11-02', weightKg: 80.5 },
    ]);
  });

  it('computes a calendar-window moving average', () => {
    const pts = [
      { day: '2026-11-01', weightKg: 80 },
      { day: '2026-11-05', weightKg: 82 },
      { day: '2026-11-10', weightKg: 84 },
    ];
    const ma = movingAverage(pts, 7);
    expect(ma.map((p) => p.weightKg)).toEqual([80, 81, 83]);
  });

  it('estimates a weekly rate by regression', () => {
    const pts = Array.from({ length: 15 }, (_, i) => ({ day: addDays('2026-11-01', i), weightKg: 80 + i * (0.5 / 7) }));
    expect(weeklyRate(pts)).toBeCloseTo(0.5, 2);
    expect(weeklyRate(pts.slice(0, 1))).toBeNull();
    expect(weeklyRate(pts.slice(0, 2))).toBeNull(); // spans < 3 days
  });

  it('summarizes, including 7-day change', () => {
    const s = summarizeWeights([
      { day: '2026-11-01', weightKg: 80 },
      { day: '2026-11-04', weightKg: 80.4 },
      { day: '2026-11-08', weightKg: 80.9 },
    ]);
    expect(s.latest).toEqual({ day: '2026-11-08', weightKg: 80.9 });
    expect(s.change7d).toBe(0.9);
    expect(summarizeWeights([])).toEqual({ latest: null, trendKg: null, ratePerWeek: null, change7d: null });
  });
});
