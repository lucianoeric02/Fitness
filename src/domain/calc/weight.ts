import { daysBetween, type DayKey } from '@/lib/dates';
import { round } from '@/lib/numbers';
import type { BodyWeightEntry } from '@/domain/models';

export interface DailyWeight {
  day: DayKey;
  weightKg: number;
}

/** One value per day (mean of that day's weigh-ins), sorted ascending by day. */
export function dailyWeights(entries: ReadonlyArray<Pick<BodyWeightEntry, 'day' | 'weightKg'>>): DailyWeight[] {
  const byDay = new Map<DayKey, { sum: number; n: number }>();
  for (const e of entries) {
    const cur = byDay.get(e.day) ?? { sum: 0, n: 0 };
    cur.sum += e.weightKg;
    cur.n += 1;
    byDay.set(e.day, cur);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, { sum, n }]) => ({ day, weightKg: round(sum / n, 2) }));
}

/**
 * Trailing moving average over a calendar window (default 7 days), applied to
 * daily weights. Each point averages the days within [day - window + 1, day].
 */
export function movingAverage(points: ReadonlyArray<DailyWeight>, windowDays = 7): DailyWeight[] {
  return points.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      const q = points[j]!;
      if (daysBetween(q.day, p.day) >= windowDays) break;
      sum += q.weightKg;
      n += 1;
    }
    return { day: p.day, weightKg: round(sum / n, 2) };
  });
}

/**
 * Rate of change in kg/week from a least-squares fit over the last
 * `windowDays` days ending at the latest point. Needs ≥ 2 points spanning ≥ 3 days.
 */
export function weeklyRate(points: ReadonlyArray<DailyWeight>, windowDays = 21): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1]!;
  const recent = points.filter((p) => daysBetween(p.day, last.day) < windowDays);
  if (recent.length < 2) return null;
  const first = recent[0]!;
  if (daysBetween(first.day, last.day) < 3) return null;
  const xs = recent.map((p) => daysBetween(first.day, p.day));
  const ys = recent.map((p) => p.weightKg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  if (den === 0) return null;
  return round((num / den) * 7, 2);
}

export interface WeightSummary {
  latest: DailyWeight | null;
  /** Latest 7-day moving average. */
  trendKg: number | null;
  /** kg/week from recent regression. */
  ratePerWeek: number | null;
  /** Change between the latest day and the closest day ≥ 7 days earlier. */
  change7d: number | null;
}

export function summarizeWeights(entries: ReadonlyArray<Pick<BodyWeightEntry, 'day' | 'weightKg'>>): WeightSummary {
  const daily = dailyWeights(entries);
  if (daily.length === 0) return { latest: null, trendKg: null, ratePerWeek: null, change7d: null };
  const latest = daily[daily.length - 1]!;
  const ma = movingAverage(daily);
  const prior = [...daily].reverse().find((p) => daysBetween(p.day, latest.day) >= 7);
  return {
    latest,
    trendKg: ma[ma.length - 1]!.weightKg,
    ratePerWeek: weeklyRate(daily),
    change7d: prior ? round(latest.weightKg - prior.weightKg, 2) : null,
  };
}
