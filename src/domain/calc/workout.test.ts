import { describe, expect, it } from 'vitest';
import { bestSet, completedWorkingSets, estimateOneRepMax, sessionDurationMin, totalVolume } from './workout';

const done = '2026-11-25T10:00:00.000Z';

describe('workout calculations', () => {
  const sets = [
    { kind: 'warmup' as const, weightKg: 60, reps: 10, completedAt: done },
    { kind: 'working' as const, weightKg: 100, reps: 8, completedAt: done },
    { kind: 'working' as const, weightKg: 100, reps: 6, completedAt: done },
    { kind: 'working' as const, weightKg: 110, reps: 5 }, // not completed
    { kind: 'drop' as const, weightKg: 70, reps: 12, completedAt: done },
  ];

  it('excludes warm-ups and incomplete sets from volume', () => {
    expect(totalVolume(sets)).toBe(800 + 600 + 840);
    expect(completedWorkingSets(sets)).toBe(3);
  });

  it('estimates 1RM (Epley)', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 10)).toBe(133.3);
    expect(estimateOneRepMax(0, 5)).toBe(0);
  });

  it('finds the best completed set', () => {
    expect(bestSet(sets)).toBe(sets[1]);
    expect(bestSet([])).toBeNull();
  });

  it('computes duration', () => {
    expect(sessionDurationMin('2026-11-25T10:00:00Z', '2026-11-25T11:15:30Z')).toBe(75);
  });
});
