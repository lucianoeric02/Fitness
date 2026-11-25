import { round } from '@/lib/numbers';
import type { SetRecord } from '@/domain/models';

type SetLike = Pick<SetRecord, 'kind' | 'weightKg' | 'reps' | 'completedAt'>;

/** Warm-up sets never count toward volume or records. */
export function countsTowardVolume(set: SetLike): boolean {
  return set.kind !== 'warmup' && Boolean(set.completedAt) && set.reps > 0;
}

export function setVolume(set: SetLike): number {
  return countsTowardVolume(set) ? set.weightKg * set.reps : 0;
}

/** Total tonnage (kg × reps) of completed working sets. */
export function totalVolume(sets: ReadonlyArray<SetLike>): number {
  return round(sets.reduce((acc, s) => acc + setVolume(s), 0), 1);
}

export function completedWorkingSets(sets: ReadonlyArray<SetLike>): number {
  return sets.filter(countsTowardVolume).length;
}

/** Epley estimated one-rep max. Returns the weight itself for single reps. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return round(weightKg * (1 + reps / 30), 1);
}

/** Best completed working set by estimated 1RM. */
export function bestSet<T extends SetLike>(sets: ReadonlyArray<T>): T | null {
  let best: T | null = null;
  let bestE1rm = 0;
  for (const s of sets) {
    if (!countsTowardVolume(s)) continue;
    const e = estimateOneRepMax(s.weightKg, s.reps);
    if (e > bestE1rm) {
      best = s;
      bestE1rm = e;
    }
  }
  return best;
}

/** Workout duration in whole minutes. */
export function sessionDurationMin(startedAt: string, endedAt?: string, now: Date = new Date()): number {
  const end = endedAt ? new Date(endedAt).getTime() : now.getTime();
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 60_000));
}
