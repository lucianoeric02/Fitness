import type { WaterEntry } from '@/domain/models';
import { metricProgress, type MetricProgress } from './nutrition';

export function sumWater(entries: ReadonlyArray<Pick<WaterEntry, 'amountMl'>>): number {
  return entries.reduce((acc, e) => acc + e.amountMl, 0);
}

export function waterProgress(entries: ReadonlyArray<Pick<WaterEntry, 'amountMl'>>, targetMl: number): MetricProgress {
  return metricProgress(sumWater(entries), targetMl);
}
