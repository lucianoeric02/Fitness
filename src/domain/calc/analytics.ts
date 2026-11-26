import { addDays, daysBetween, startOfWeek, type DayKey } from '@/lib/dates';
import { round } from '@/lib/numbers';
import type { FoodEntry, MuscleGroup, Nutrients, NutritionTarget, SetRecord, WorkoutSession } from '@/domain/models';
import { sumNutrients, targetForDay } from './nutrition';
import { estimateOneRepMax, totalVolume } from './workout';

// ---- Date ranges ------------------------------------------------------------------

export type RangeKey = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';

export const RANGE_LABELS: Record<RangeKey, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias', '6m': '6 meses', '1y': '1 ano', all: 'Tudo' };

const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90, '6m': 182, '1y': 365 };

/** First day of the range (inclusive), or null for "all". */
export function rangeStart(today: DayKey, range: RangeKey): DayKey | null {
  return range === 'all' ? null : addDays(today, -(RANGE_DAYS[range] - 1));
}

export function inRange<T extends { day: DayKey }>(rows: ReadonlyArray<T>, from: DayKey | null, to: DayKey): T[] {
  return rows.filter((r) => (!from || r.day >= from) && r.day <= to);
}

// ---- Series --------------------------------------------------------------------------

export interface SeriesPoint {
  day: DayKey;
  value: number;
}

/** Change from the first to the last point; null with fewer than two points. */
export function seriesChange(points: ReadonlyArray<SeriesPoint>): { from: SeriesPoint; to: SeriesPoint; delta: number; days: number } | null {
  if (points.length < 2) return null;
  const from = points[0]!;
  const to = points[points.length - 1]!;
  return { from, to, delta: round(to.value - from.value, 2), days: daysBetween(from.day, to.day) };
}

// ---- Weeks ------------------------------------------------------------------------------

/** Week start days covering [from, to]. */
export function weekStarts(from: DayKey, to: DayKey, weekStartsOn: 0 | 1): DayKey[] {
  const out: DayKey[] = [];
  for (let w = startOfWeek(from, weekStartsOn); w <= to; w = addDays(w, 7)) out.push(w);
  return out;
}

export interface WeekTraining {
  weekStart: DayKey;
  sessions: number;
  trainingDays: number;
  volumeKg: number;
  sets: number;
}

/** Sessions, distinct training days, volume and completed working sets per week. */
export function trainingByWeek(
  sessions: ReadonlyArray<Pick<WorkoutSession, 'id' | 'day' | 'status'>>,
  sets: ReadonlyArray<Pick<SetRecord, 'sessionId' | 'kind' | 'weightKg' | 'reps' | 'completedAt'>>,
  weeks: ReadonlyArray<DayKey>,
): WeekTraining[] {
  return weeks.map((w) => {
    const end = addDays(w, 6);
    const s = sessions.filter((x) => x.status === 'completed' && x.day >= w && x.day <= end);
    const ids = new Set(s.map((x) => x.id));
    const own = sets.filter((x) => ids.has(x.sessionId));
    return {
      weekStart: w,
      sessions: s.length,
      trainingDays: new Set(s.map((x) => x.day)).size,
      volumeKg: totalVolume(own),
      sets: own.filter((x) => x.completedAt && x.kind !== 'warmup').length,
    };
  });
}

/** Share of weeks with at least `minSessions` sessions (only weeks fully or partly elapsed). */
export function weeklyConsistency(weeks: ReadonlyArray<WeekTraining>, minSessions = 1): { weeksHit: number; weeks: number } {
  return { weeksHit: weeks.filter((w) => w.sessions >= minSessions).length, weeks: weeks.length };
}

/** Completed working sets per primary muscle. */
export function setsByMuscle(
  items: ReadonlyArray<{ id: string; primaryMuscle?: MuscleGroup }>,
  sets: ReadonlyArray<Pick<SetRecord, 'sessionExerciseId' | 'kind' | 'completedAt'>>,
): Array<{ muscle: MuscleGroup; sets: number }> {
  const muscleOf = new Map(items.map((i) => [i.id, i.primaryMuscle]));
  const counts = new Map<MuscleGroup, number>();
  for (const s of sets) {
    if (!s.completedAt || s.kind === 'warmup') continue;
    const m = muscleOf.get(s.sessionExerciseId);
    if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.entries()].map(([muscle, n]) => ({ muscle, sets: n })).sort((a, b) => b.sets - a.sets);
}

/** Best estimated 1RM per session for an exercise, oldest → newest. */
export function e1rmSeries(history: ReadonlyArray<{ session: Pick<WorkoutSession, 'day'>; sets: ReadonlyArray<Pick<SetRecord, 'kind' | 'weightKg' | 'reps' | 'completedAt'>> }>): SeriesPoint[] {
  return history
    .map((h) => ({
      day: h.session.day,
      value: h.sets.filter((s) => s.completedAt && s.kind !== 'warmup' && s.weightKg > 0).reduce((b, s) => Math.max(b, estimateOneRepMax(s.weightKg, s.reps)), 0),
    }))
    .filter((p) => p.value > 0)
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

// ---- Nutrition -------------------------------------------------------------------------

/** Minimum logged days before averages/adherence are shown. */
export const MIN_LOGGED_DAYS = 3;
/** "Near target": within ±10% of the calorie target. */
export const NEAR_TARGET_TOLERANCE = 0.1;

export interface NutritionAnalytics {
  totalDays: number;
  loggedDays: number;
  /** Per logged day, oldest → newest. */
  days: Array<{ day: DayKey; totals: Nutrients; targetKcal: number | null }>;
  /** Averages over logged days only; null when too few days. */
  averages: Nutrients | null;
  /** Logged days within ±10% of their own day's calorie target; null when too few. */
  nearTarget: { days: number; of: number } | null;
}

export function nutritionAnalytics(
  entries: ReadonlyArray<Pick<FoodEntry, 'day' | 'nutrients'>>,
  targets: ReadonlyArray<Pick<NutritionTarget, 'effectiveFrom' | 'kcal'>>,
  from: DayKey,
  to: DayKey,
): NutritionAnalytics {
  const byDay = new Map<DayKey, Array<Pick<FoodEntry, 'nutrients'>>>();
  for (const e of entries) {
    if (e.day < from || e.day > to) continue;
    byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, list]) => ({ day, totals: sumNutrients(list), targetKcal: targetForDay(targets, day)?.kcal ?? null }));
  const enough = days.length >= MIN_LOGGED_DAYS;
  const avg = (k: keyof Nutrients) => round(days.reduce((a, d) => a + (d.totals[k] ?? 0), 0) / days.length, 1);
  const withTarget = days.filter((d) => d.targetKcal);
  return {
    totalDays: daysBetween(from, to) + 1,
    loggedDays: days.length,
    days,
    averages: enough ? { kcal: Math.round(avg('kcal')), proteinG: avg('proteinG'), carbsG: avg('carbsG'), fatG: avg('fatG') } : null,
    nearTarget:
      enough && withTarget.length
        ? { days: withTarget.filter((d) => Math.abs(d.totals.kcal - d.targetKcal!) <= d.targetKcal! * NEAR_TARGET_TOLERANCE).length, of: withTarget.length }
        : null,
  };
}

// ---- Hydration ----------------------------------------------------------------------------

/** Average ml per day over days that have any entry, and over all days (0 for empty). */
export function hydrationAverages(entries: ReadonlyArray<{ day: DayKey; amountMl: number }>, from: DayKey, to: DayKey) {
  const byDay = new Map<DayKey, number>();
  for (const e of entries) if (e.day >= from && e.day <= to) byDay.set(e.day, (byDay.get(e.day) ?? 0) + e.amountMl);
  const totalDays = daysBetween(from, to) + 1;
  const sum = [...byDay.values()].reduce((a, b) => a + b, 0);
  return {
    loggedDays: byDay.size,
    totalDays,
    avgLoggedDays: byDay.size ? Math.round(sum / byDay.size) : null,
    avgAllDays: Math.round(sum / totalDays),
  };
}
