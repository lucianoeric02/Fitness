import { dayRange, type DayKey } from '@/lib/dates';
import type { WaterEntry } from '@/domain/models';
import { metricProgress, type MetricProgress } from './nutrition';

export function sumWater(entries: ReadonlyArray<Pick<WaterEntry, 'amountMl'>>): number {
  return entries.reduce((acc, e) => acc + e.amountMl, 0);
}

export function waterProgress(entries: ReadonlyArray<Pick<WaterEntry, 'amountMl'>>, targetMl: number): MetricProgress {
  return metricProgress(sumWater(entries), targetMl);
}


export interface DailyWater {
  day: DayKey;
  totalMl: number;
  entries: number;
}

/** Totals per day for an inclusive range, including days with nothing logged. */
export function dailyWaterTotals(entries: ReadonlyArray<Pick<WaterEntry, 'day' | 'amountMl'>>, from: DayKey, to: DayKey): DailyWater[] {
  const map = new Map<DayKey, DailyWater>();
  for (const d of dayRange(from, to)) map.set(d, { day: d, totalMl: 0, entries: 0 });
  for (const e of entries) {
    const row = map.get(e.day);
    if (!row) continue;
    row.totalMl += e.amountMl;
    row.entries += 1;
  }
  return [...map.values()];
}

/** Days (with any entry) that reached the target, among the given days. */
export function daysOnTarget(days: ReadonlyArray<DailyWater>, targetMl: number): number {
  return days.filter((d) => d.totalMl >= targetMl && targetMl > 0).length;
}
