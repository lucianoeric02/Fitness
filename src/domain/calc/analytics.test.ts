import { describe, expect, it } from 'vitest';
import { e1rmSeries, hydrationAverages, inRange, nutritionAnalytics, rangeStart, seriesChange, setsByMuscle, trainingByWeek, weekStarts, weeklyConsistency } from './analytics';

const done = '2026-11-20T10:00:00Z';
const n = (kcal: number, p = 0) => ({ nutrients: { kcal, proteinG: p, carbsG: 0, fatG: 0 } });

describe('date filtering', () => {
  it('computes inclusive range starts', () => {
    expect(rangeStart('2026-11-26', '7d')).toBe('2026-11-20');
    expect(rangeStart('2026-11-26', '30d')).toBe('2026-10-28');
    expect(rangeStart('2026-11-26', 'all')).toBeNull();
    const rows = [{ day: '2026-11-19' }, { day: '2026-11-20' }, { day: '2026-11-26' }, { day: '2026-11-27' }];
    expect(inRange(rows, '2026-11-20', '2026-11-26').map((r) => r.day)).toEqual(['2026-11-20', '2026-11-26']);
    expect(inRange(rows, null, '2026-11-26')).toHaveLength(3);
  });
});

describe('sparse series', () => {
  it('needs two points for a change and never invents values', () => {
    expect(seriesChange([])).toBeNull();
    expect(seriesChange([{ day: '2026-11-01', value: 80 }])).toBeNull();
    expect(seriesChange([{ day: '2026-11-01', value: 80 }, { day: '2026-11-30', value: 81.4 }])).toMatchObject({ delta: 1.4, days: 29 });
  });

  it('builds the e1RM series only from loaded working sets', () => {
    const s = e1rmSeries([
      { session: { day: '2026-11-10' }, sets: [{ kind: 'working', weightKg: 100, reps: 5, completedAt: done }, { kind: 'warmup', weightKg: 140, reps: 1, completedAt: done }] },
      { session: { day: '2026-11-03' }, sets: [{ kind: 'working', weightKg: 0, reps: 20, completedAt: done }] },
    ]);
    expect(s).toEqual([{ day: '2026-11-10', value: 116.7 }]);
  });
});

describe('training by week', () => {
  it('buckets sessions, volume and sets per week and measures consistency', () => {
    const weeks = weekStarts('2026-11-09', '2026-11-26', 1);
    expect(weeks).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
    const sessions = [
      { id: 'a', day: '2026-11-10', status: 'completed' as const },
      { id: 'b', day: '2026-11-10', status: 'completed' as const },
      { id: 'c', day: '2026-11-24', status: 'completed' as const },
      { id: 'd', day: '2026-11-25', status: 'discarded' as const },
    ];
    const sets = [
      { sessionId: 'a', kind: 'working' as const, weightKg: 100, reps: 5, completedAt: done },
      { sessionId: 'c', kind: 'warmup' as const, weightKg: 50, reps: 10, completedAt: done },
      { sessionId: 'c', kind: 'working' as const, weightKg: 60, reps: 10, completedAt: done },
    ];
    const w = trainingByWeek(sessions, sets, weeks);
    expect(w.map((x) => [x.sessions, x.trainingDays, x.volumeKg, x.sets])).toEqual([
      [2, 1, 500, 1],
      [0, 0, 0, 0],
      [1, 1, 600, 1],
    ]);
    expect(weeklyConsistency(w)).toEqual({ weeksHit: 2, weeks: 3 });
  });

  it('counts working sets per muscle', () => {
    const items = [
      { id: 'x', primaryMuscle: 'chest' as const },
      { id: 'y', primaryMuscle: 'back' as const },
    ];
    const sets = [
      { sessionExerciseId: 'x', kind: 'working' as const, completedAt: done },
      { sessionExerciseId: 'x', kind: 'working' as const, completedAt: done },
      { sessionExerciseId: 'x', kind: 'warmup' as const, completedAt: done },
      { sessionExerciseId: 'y', kind: 'working' as const },
    ];
    expect(setsByMuscle(items, sets)).toEqual([{ muscle: 'chest', sets: 2 }]);
  });
});

describe('nutrition analytics', () => {
  const targets = [{ effectiveFrom: '2026-11-01', kcal: 3400 }];
  it('withholds averages and adherence with too few logged days', () => {
    const a = nutritionAnalytics([{ day: '2026-11-20', ...n(3000) }, { day: '2026-11-21', ...n(3300) }], targets, '2026-11-15', '2026-11-21');
    expect(a).toMatchObject({ totalDays: 7, loggedDays: 2, averages: null, nearTarget: null });
  });

  it('averages over logged days only and counts days within ±10% of target', () => {
    const entries = [
      { day: '2026-11-19', ...n(1500, 50) },
      { day: '2026-11-19', ...n(1600, 50) }, // 3100 → within 10%
      { day: '2026-11-20', ...n(3400, 180) },
      { day: '2026-11-21', ...n(2000, 90) }, // outside
      { day: '2026-11-30', ...n(9999) }, // outside range
    ];
    const a = nutritionAnalytics(entries, targets, '2026-11-15', '2026-11-21');
    expect(a.loggedDays).toBe(3);
    expect(a.averages).toEqual({ kcal: 2833, proteinG: 123.3, carbsG: 0, fatG: 0 });
    expect(a.nearTarget).toEqual({ days: 2, of: 3 });
  });
});

describe('hydration averages', () => {
  it('reports averages over logged days and over all days', () => {
    const h = hydrationAverages([{ day: '2026-11-20', amountMl: 3000 }, { day: '2026-11-20', amountMl: 1000 }, { day: '2026-11-22', amountMl: 2000 }], '2026-11-20', '2026-11-23');
    expect(h).toEqual({ loggedDays: 2, totalDays: 4, avgLoggedDays: 3000, avgAllDays: 1500 });
  });
});
