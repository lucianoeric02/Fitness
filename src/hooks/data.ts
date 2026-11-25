/**
 * Reactive data hooks backed by Dexie live queries. Convention:
 * `undefined` = still loading, `null` = loaded but absent.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { getPrimaryGoal, listBodyWeights } from '@/data/repos/body';
import { getProfile, getSettings } from '@/data/repos/profile';
import { getTargetForDay, listTargets } from '@/data/repos/targets';
import { sumNutrients } from '@/domain/calc/nutrition';
import { sumWater } from '@/domain/calc/water';
import { summarizeWeights } from '@/domain/calc/weight';
import type { DayKey } from '@/lib/dates';

export function useProfile() {
  return useLiveQuery(() => getProfile(), []);
}

export function useSettings() {
  return useLiveQuery(() => getSettings(), []);
}

export function useTargetForDay(day: DayKey) {
  return useLiveQuery(() => getTargetForDay(day), [day]);
}

export function useTargetHistory() {
  return useLiveQuery(() => listTargets(), []);
}

export function useDayNutritionTotals(day: DayKey) {
  return useLiveQuery(async () => {
    const entries = await db.foodEntries.where('day').equals(day).toArray();
    return { entries: entries.length, totals: sumNutrients(entries) };
  }, [day]);
}

export function useDayWaterMl(day: DayKey) {
  return useLiveQuery(async () => sumWater(await db.waterEntries.where('day').equals(day).toArray()), [day]);
}

export function useWeightSummary() {
  return useLiveQuery(async () => summarizeWeights(await listBodyWeights()), []);
}

export function usePrimaryGoal() {
  return useLiveQuery(() => getPrimaryGoal(), []);
}

export function useDaySessions(day: DayKey) {
  return useLiveQuery(() => db.workoutSessions.where('day').equals(day).toArray(), [day]);
}
