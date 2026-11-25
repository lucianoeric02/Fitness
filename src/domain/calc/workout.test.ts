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

import { activeDurationMs, estimateDurationMin, newRecords, nextInRotation, personalRecords, sessionStats } from './workout';

describe('rotation', () => {
  const t = (id: string, sortOrder: number, active = true) => ({ id, sortOrder, active });
  const templates = [t('B', 1), t('A', 0), t('X', 2, false), t('C', 3)];

  it('suggests the routine after the last completed one, wrapping around', () => {
    expect(nextInRotation(templates, undefined)?.id).toBe('A');
    expect(nextInRotation(templates, 'A')?.id).toBe('B');
    expect(nextInRotation(templates, 'B')?.id).toBe('C'); // skips inactive X
    expect(nextInRotation(templates, 'C')?.id).toBe('A');
    expect(nextInRotation(templates, 'X')?.id).toBe('A'); // last one no longer active
    expect(nextInRotation([], 'A')).toBeNull();
  });

  it('estimates duration from sets and rest', () => {
    expect(estimateDurationMin([{ targetSets: 4, restSec: 120 }, { targetSets: 3, restSec: 60 }])).toBe(Math.round((4 * 45 + 3 * 120 + 3 * 45 + 2 * 60) / 60));
  });
});

describe('session metrics', () => {
  it('excludes paused time from duration (including an ongoing pause)', () => {
    const s = { startedAt: '2026-11-25T10:00:00Z', pausedMs: 5 * 60_000 };
    expect(activeDurationMs({ ...s, endedAt: '2026-11-25T11:00:00Z' })).toBe(55 * 60_000);
    expect(activeDurationMs({ ...s, pausedAt: '2026-11-25T10:30:00Z' }, Date.parse('2026-11-25T12:00:00Z'))).toBe(25 * 60_000);
  });

  it('computes sets, reps, volume and sets per muscle', () => {
    const exercises = [
      { id: 'a', primaryMuscle: 'chest' },
      { id: 'b', primaryMuscle: 'triceps' },
      { id: 'c', primaryMuscle: 'back', skipped: true },
    ];
    const sets = [
      { sessionExerciseId: 'a', kind: 'warmup' as const, weightKg: 40, reps: 10, completedAt: done },
      { sessionExerciseId: 'a', kind: 'working' as const, weightKg: 100, reps: 8, completedAt: done },
      { sessionExerciseId: 'b', kind: 'working' as const, weightKg: 30, reps: 12, completedAt: done },
      { sessionExerciseId: 'b', kind: 'working' as const, weightKg: 30, reps: 12 },
    ];
    const st = sessionStats(exercises, sets);
    expect(st).toMatchObject({ totalSets: 4, completedSets: 3, totalReps: 30, volumeKg: 800 + 360, exercisesCompleted: 1, exercisesTotal: 2 });
    expect(st.setsByMuscle).toEqual({ chest: 1, triceps: 1 });
  });
});

describe('personal records', () => {
  const s = (weightKg: number, reps: number) => ({ kind: 'working' as const, weightKg, reps, completedAt: done });

  it('finds heaviest, best e1RM and most reps transparently', () => {
    const pr = personalRecords([s(100, 5), s(90, 10), s(60, 15), { ...s(140, 1), kind: 'warmup' as const }]);
    expect(pr.heaviest).toEqual({ weightKg: 100, reps: 5 });
    expect(pr.bestE1rm).toEqual({ weightKg: 90, reps: 10, e1rm: 120 });
    expect(pr.mostReps).toEqual({ weightKg: 60, reps: 15 });
  });

  it('flags new records only against existing history', () => {
    expect(newRecords([], [s(100, 5)])).toEqual([]);
    expect(newRecords([s(100, 5)], [s(102.5, 5)])).toEqual(['heaviest', 'e1rm']);
    expect(newRecords([s(100, 5)], [s(100, 7)])).toEqual(['e1rm', 'reps']);
    expect(newRecords([s(100, 5)], [s(95, 5)])).toEqual([]);
  });
});
