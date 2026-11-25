/**
 * Reactive data hooks backed by Dexie live queries. Convention:
 * `undefined` = still loading, `null` = loaded but absent.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { getPrimaryGoal, listBodyWeights, listMeasurements } from '@/data/repos/body';
import { listGoals } from '@/data/repos/goals';
import { getProfile, getSettings } from '@/data/repos/profile';
import { getTargetForDay, listTargets } from '@/data/repos/targets';
import { lastWaterEntry } from '@/data/repos/water';
import { resolveGoalCurrent, type CurrentValue, type GoalRecords } from '@/domain/calc/goalCurrent';
import { evaluateGoal, type GoalEvaluation } from '@/domain/calc/goals';
import { sumNutrients } from '@/domain/calc/nutrition';
import { sumWater } from '@/domain/calc/water';
import { summarizeWeek, weekBounds } from '@/domain/calc/weekly';
import { summarizeWeights } from '@/domain/calc/weight';
import type { Goal } from '@/domain/models';
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

export function useDayWater(day: DayKey) {
  return useLiveQuery(async () => {
    const entries = await db.waterEntries.where('day').equals(day).toArray();
    return { totalMl: sumWater(entries), last: (await lastWaterEntry(day)) ?? null };
  }, [day]);
}

export function useWeightSummary() {
  return useLiveQuery(async () => summarizeWeights(await listBodyWeights()), []);
}

/** Weigh-ins, newest first. */
export function useWeightHistory() {
  return useLiveQuery(async () => (await listBodyWeights()).reverse(), []);
}

export function useMeasurementHistory() {
  return useLiveQuery(() => listMeasurements(), []);
}

/** Composition entries, newest first. */
export function useCompositionHistory() {
  return useLiveQuery(async () => (await db.bodyComposition.orderBy('day').toArray()).reverse(), []);
}

export function usePrimaryGoal() {
  return useLiveQuery(() => getPrimaryGoal(), []);
}

export function useDaySessions(day: DayKey) {
  return useLiveQuery(() => db.workoutSessions.where('day').equals(day).toArray(), [day]);
}

export interface GoalView {
  goal: Goal;
  current: CurrentValue;
  evaluation: GoalEvaluation;
}

async function loadGoalRecords(today: DayKey): Promise<GoalRecords> {
  const [weights, composition, measurements, sessions, settings] = await Promise.all([
    db.bodyWeights.toArray(),
    db.bodyComposition.toArray(),
    db.measurements.toArray(),
    db.workoutSessions.toArray(),
    getSettings(),
  ]);
  return { weights, composition, measurements, sessions, ...weekBounds(today, settings.weekStartsOn) };
}

/** Records used to derive goal current values (for goal forms). */
export function useGoalRecords(today: DayKey) {
  return useLiveQuery(() => loadGoalRecords(today), [today]);
}

/** All goals with their derived current value and progress. */
export function useGoalViews(today: DayKey) {
  return useLiveQuery(async () => {
    const [goals, records] = await Promise.all([listGoals(), loadGoalRecords(today)]);
    return goals.map<GoalView>((goal) => {
      const current = resolveGoalCurrent(goal, records);
      return { goal, current, evaluation: evaluateGoal(goal.startValue, current.value, goal.targetValue) };
    });
  }, [today]);
}

export function useWeekSummary(today: DayKey) {
  return useLiveQuery(async () => {
    const settings = await getSettings();
    const { weekStart } = weekBounds(today, settings.weekStartsOn);
    const [sessions, foodEntries] = await Promise.all([
      db.workoutSessions.where('day').between(weekStart, today, true, true).toArray(),
      db.foodEntries.where('day').between(weekStart, today, true, true).toArray(),
    ]);
    return summarizeWeek({ today, weekStartsOn: settings.weekStartsOn, sessions, foodEntries });
  }, [today]);
}
