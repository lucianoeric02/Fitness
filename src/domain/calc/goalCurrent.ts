import type { DayKey } from '@/lib/dates';
import { measurementKey, GOAL_KINDS } from '@/domain/catalog';
import type { BodyCompositionEntry, BodyWeightEntry, Goal, MeasurementEntry, WorkoutSession } from '@/domain/models';

export interface GoalRecords {
  weights: ReadonlyArray<Pick<BodyWeightEntry, 'day' | 'measuredAt' | 'weightKg'>>;
  composition: ReadonlyArray<Pick<BodyCompositionEntry, 'day' | 'measuredAt' | 'bodyFatPct' | 'muscleMassKg'>>;
  measurements: ReadonlyArray<Pick<MeasurementEntry, 'day' | 'measuredAt' | 'site' | 'customName' | 'valueCm'>>;
  sessions: ReadonlyArray<Pick<WorkoutSession, 'day' | 'status'>>;
  /** Current week bounds for consistency goals. */
  weekStart: DayKey;
  weekEnd: DayKey;
}

export interface CurrentValue {
  value: number | null;
  /** Where the value came from. */
  source: 'record' | 'manual' | 'none';
  /** Day of the record, when from a record. */
  day?: DayKey;
}

function latest<T extends { day: DayKey; measuredAt: string }>(rows: ReadonlyArray<T>, pick: (r: T) => number | undefined): { value: number; day: DayKey } | null {
  let best: T | null = null;
  for (const r of rows) {
    if (pick(r) === undefined) continue;
    if (!best || r.day > best.day || (r.day === best.day && r.measuredAt > best.measuredAt)) best = r;
  }
  return best ? { value: pick(best)!, day: best.day } : null;
}

/**
 * Current value rule: always the most recent valid record for the goal's
 * category; manual categories use the goal's own manualCurrentValue.
 */
export function resolveGoalCurrent(goal: Pick<Goal, 'kind' | 'ref' | 'refName' | 'manualCurrentValue'>, r: GoalRecords): CurrentValue {
  const toCurrent = (x: { value: number; day: DayKey } | null): CurrentValue => (x ? { value: x.value, source: 'record', day: x.day } : { value: null, source: 'none' });
  switch (GOAL_KINDS[goal.kind].source) {
    case 'weight':
      return toCurrent(latest(r.weights, (w) => w.weightKg));
    case 'body_fat':
      return toCurrent(latest(r.composition, (c) => c.bodyFatPct));
    case 'muscle_mass':
      return toCurrent(latest(r.composition, (c) => c.muscleMassKg));
    case 'measurement': {
      if (!goal.ref) return { value: null, source: 'none' };
      const key = measurementKey(goal.ref, goal.refName);
      return toCurrent(latest(r.measurements.filter((m) => measurementKey(m.site, m.customName) === key), (m) => m.valueCm));
    }
    case 'sessions': {
      const done = r.sessions.filter((s) => s.status === 'completed' && s.day >= r.weekStart && s.day <= r.weekEnd).length;
      return { value: done, source: 'record' };
    }
    case 'manual':
      return goal.manualCurrentValue === undefined ? { value: null, source: 'none' } : { value: goal.manualCurrentValue, source: 'manual' };
  }
}
