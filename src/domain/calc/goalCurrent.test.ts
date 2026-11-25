import { describe, expect, it } from 'vitest';
import { resolveGoalCurrent, type GoalRecords } from './goalCurrent';

const records: GoalRecords = {
  weights: [
    { day: '2026-11-20', measuredAt: '2026-11-20T08:00:00Z', weightKg: 80 },
    { day: '2026-11-24', measuredAt: '2026-11-24T08:00:00Z', weightKg: 80.8 },
    { day: '2026-11-22', measuredAt: '2026-11-22T08:00:00Z', weightKg: 80.4 },
  ],
  composition: [
    { day: '2026-11-01', measuredAt: 'a', bodyFatPct: 18, muscleMassKg: 36 },
    { day: '2026-11-15', measuredAt: 'b', bodyFatPct: 17.2 }, // no muscle mass this time
  ],
  measurements: [
    { day: '2026-11-01', measuredAt: 'a', site: 'arm_right', valueCm: 39 },
    { day: '2026-11-20', measuredAt: 'b', site: 'arm_right', valueCm: 39.6 },
    { day: '2026-11-20', measuredAt: 'b', site: 'arm_left', valueCm: 39.1 },
    { day: '2026-11-21', measuredAt: 'c', site: 'custom', customName: 'Ombro', valueCm: 120 },
  ],
  sessions: [
    { day: '2026-11-23', status: 'completed' },
    { day: '2026-11-24', status: 'completed' },
    { day: '2026-11-25', status: 'in_progress' },
    { day: '2026-11-16', status: 'completed' }, // previous week
  ],
  weekStart: '2026-11-23',
  weekEnd: '2026-11-29',
};

describe('resolveGoalCurrent', () => {
  it('uses the most recent valid record per category', () => {
    expect(resolveGoalCurrent({ kind: 'body_weight' }, records)).toEqual({ value: 80.8, source: 'record', day: '2026-11-24' });
    expect(resolveGoalCurrent({ kind: 'body_fat' }, records).value).toBe(17.2);
    expect(resolveGoalCurrent({ kind: 'muscle_mass' }, records)).toEqual({ value: 36, source: 'record', day: '2026-11-01' });
  });

  it('keeps measurement sides and custom names separate', () => {
    expect(resolveGoalCurrent({ kind: 'measurement', ref: 'arm_right' }, records).value).toBe(39.6);
    expect(resolveGoalCurrent({ kind: 'measurement', ref: 'arm_left' }, records).value).toBe(39.1);
    expect(resolveGoalCurrent({ kind: 'measurement', ref: 'custom', refName: 'ombro' }, records).value).toBe(120);
    expect(resolveGoalCurrent({ kind: 'measurement', ref: 'waist' }, records)).toEqual({ value: null, source: 'none' });
  });

  it('counts completed workouts in the current week', () => {
    expect(resolveGoalCurrent({ kind: 'consistency' }, records).value).toBe(2);
  });

  it('uses the manual value for performance and conditioning', () => {
    expect(resolveGoalCurrent({ kind: 'performance', manualCurrentValue: 110 }, records)).toEqual({ value: 110, source: 'manual' });
    expect(resolveGoalCurrent({ kind: 'conditioning' }, records)).toEqual({ value: null, source: 'none' });
  });

  it('returns no value when there are no records', () => {
    expect(resolveGoalCurrent({ kind: 'body_weight' }, { ...records, weights: [] })).toEqual({ value: null, source: 'none' });
  });
});
