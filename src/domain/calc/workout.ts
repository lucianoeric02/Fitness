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

// ---- Sessions -------------------------------------------------------------

/** Active duration in ms, excluding paused time (and an ongoing pause). */
export function activeDurationMs(
  s: { startedAt: string; endedAt?: string; pausedAt?: string; pausedMs?: number },
  now: number = Date.now(),
): number {
  const end = s.endedAt ? new Date(s.endedAt).getTime() : s.pausedAt ? new Date(s.pausedAt).getTime() : now;
  return Math.max(0, end - new Date(s.startedAt).getTime() - (s.pausedMs ?? 0));
}

export interface SessionStats {
  totalSets: number;
  completedSets: number;
  totalReps: number;
  /** kg × reps of completed working sets (warm-ups excluded). */
  volumeKg: number;
  exercisesCompleted: number;
  exercisesTotal: number;
  /** Completed working sets per primary muscle. */
  setsByMuscle: Record<string, number>;
}

type StatSet = Pick<SetRecord, 'kind' | 'weightKg' | 'reps' | 'completedAt' | 'sessionExerciseId'>;
type StatExercise = { id: string; primaryMuscle?: string; skipped?: boolean };

export function sessionStats(exercises: ReadonlyArray<StatExercise>, sets: ReadonlyArray<StatSet>): SessionStats {
  const done = sets.filter((s) => s.completedAt);
  const byMuscle: Record<string, number> = {};
  for (const s of done) {
    if (s.kind === 'warmup') continue;
    const m = exercises.find((e) => e.id === s.sessionExerciseId)?.primaryMuscle;
    if (m) byMuscle[m] = (byMuscle[m] ?? 0) + 1;
  }
  const active = exercises.filter((e) => !e.skipped);
  return {
    totalSets: sets.length,
    completedSets: done.length,
    totalReps: done.reduce((a, s) => a + s.reps, 0),
    volumeKg: totalVolume(sets),
    exercisesCompleted: active.filter((e) => {
      const own = sets.filter((s) => s.sessionExerciseId === e.id);
      return own.length > 0 && own.every((s) => s.completedAt);
    }).length,
    exercisesTotal: active.length,
    setsByMuscle: byMuscle,
  };
}

// ---- Rotation & planning ----------------------------------------------------

/**
 * Next routine in the rotation: the active template after the one used in
 * the most recent completed session; the first one when there is no history
 * or the last template is no longer active.
 */
export function nextInRotation<T extends { id: string; sortOrder: number; active: boolean }>(
  templates: ReadonlyArray<T>,
  lastCompletedTemplateId: string | undefined,
): T | null {
  const active = templates.filter((t) => t.active).sort((a, b) => a.sortOrder - b.sortOrder);
  if (active.length === 0) return null;
  const idx = active.findIndex((t) => t.id === lastCompletedTemplateId);
  return idx === -1 ? active[0]! : active[(idx + 1) % active.length]!;
}

/** Rough duration estimate: ~45 s per set plus prescribed rest between sets. */
export function estimateDurationMin(items: ReadonlyArray<{ targetSets: number; restSec: number }>): number {
  const sec = items.reduce((acc, i) => acc + i.targetSets * 45 + Math.max(0, i.targetSets - 1) * i.restSec, 0);
  return Math.round(sec / 60);
}

// ---- Progression & records ----------------------------------------------------

export interface PerformanceSet {
  weightKg: number;
  reps: number;
}

export interface PersonalRecords {
  heaviest: PerformanceSet | null;
  bestE1rm: (PerformanceSet & { e1rm: number }) | null;
  mostReps: PerformanceSet | null;
}

/** Records across completed working sets. Transparent: plain max of logged values. */
export function personalRecords(sets: ReadonlyArray<Pick<SetRecord, 'kind' | 'weightKg' | 'reps' | 'completedAt'>>): PersonalRecords {
  let heaviest: PerformanceSet | null = null;
  let bestE1rm: PersonalRecords['bestE1rm'] = null;
  let mostReps: PerformanceSet | null = null;
  for (const s of sets) {
    if (!countsTowardVolume(s)) continue;
    if (!heaviest || s.weightKg > heaviest.weightKg || (s.weightKg === heaviest.weightKg && s.reps > heaviest.reps)) heaviest = { weightKg: s.weightKg, reps: s.reps };
    const e = estimateOneRepMax(s.weightKg, s.reps);
    if (s.weightKg > 0 && (!bestE1rm || e > bestE1rm.e1rm)) bestE1rm = { weightKg: s.weightKg, reps: s.reps, e1rm: e };
    if (!mostReps || s.reps > mostReps.reps || (s.reps === mostReps.reps && s.weightKg > mostReps.weightKg)) mostReps = { weightKg: s.weightKg, reps: s.reps };
  }
  return { heaviest, bestE1rm, mostReps };
}

export type PrKind = 'heaviest' | 'e1rm' | 'reps';

/** Which records the new sets beat compared with all earlier history. */
export function newRecords(
  before: ReadonlyArray<Pick<SetRecord, 'kind' | 'weightKg' | 'reps' | 'completedAt'>>,
  current: ReadonlyArray<Pick<SetRecord, 'kind' | 'weightKg' | 'reps' | 'completedAt'>>,
): PrKind[] {
  const prev = personalRecords(before);
  const now = personalRecords(current);
  // No history: a first session isn't a "record".
  if (!prev.heaviest) return [];
  const out: PrKind[] = [];
  if (now.heaviest && now.heaviest.weightKg > prev.heaviest.weightKg) out.push('heaviest');
  if (now.bestE1rm && prev.bestE1rm && now.bestE1rm.e1rm > prev.bestE1rm.e1rm) out.push('e1rm');
  if (now.mostReps && prev.mostReps && now.mostReps.reps > prev.mostReps.reps && now.mostReps.weightKg >= prev.mostReps.weightKg) out.push('reps');
  return out;
}
