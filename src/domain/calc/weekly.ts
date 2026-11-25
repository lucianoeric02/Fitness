import { addDays, daysBetween, startOfWeek, type DayKey } from '@/lib/dates';
import type { FoodEntry, WorkoutSession } from '@/domain/models';

/** Minimum logged days before nutrition consistency is reported. */
export const MIN_NUTRITION_DAYS = 3;

export interface WeekSummary {
  weekStart: DayKey;
  weekEnd: DayKey;
  /** Days of this week up to and including today. */
  daysElapsed: number;
  workoutsCompleted: number;
  trainingDays: number;
  /** Planned workouts this week; null until weekly planning exists. */
  workoutsPlanned: number | null;
  /** Null when there is not enough data to say anything honest. */
  nutrition: { daysLogged: number; daysElapsed: number; ratio: number } | null;
  nutritionDaysLogged: number;
}

export function weekBounds(today: DayKey, weekStartsOn: 0 | 1) {
  const weekStart = startOfWeek(today, weekStartsOn);
  return { weekStart, weekEnd: addDays(weekStart, 6) };
}

export function summarizeWeek(input: {
  today: DayKey;
  weekStartsOn: 0 | 1;
  sessions: ReadonlyArray<Pick<WorkoutSession, 'day' | 'status'>>;
  foodEntries: ReadonlyArray<Pick<FoodEntry, 'day'>>;
  workoutsPlanned?: number | null;
}): WeekSummary {
  const { weekStart, weekEnd } = weekBounds(input.today, input.weekStartsOn);
  const inWeek = (d: DayKey) => d >= weekStart && d <= input.today;
  const completed = input.sessions.filter((s) => s.status === 'completed' && inWeek(s.day));
  const daysElapsed = daysBetween(weekStart, input.today) + 1;
  const loggedDays = new Set(input.foodEntries.filter((e) => inWeek(e.day)).map((e) => e.day)).size;
  return {
    weekStart,
    weekEnd,
    daysElapsed,
    workoutsCompleted: completed.length,
    trainingDays: new Set(completed.map((s) => s.day)).size,
    workoutsPlanned: input.workoutsPlanned ?? null,
    nutrition: loggedDays >= MIN_NUTRITION_DAYS ? { daysLogged: loggedDays, daysElapsed, ratio: loggedDays / daysElapsed } : null,
    nutritionDaysLogged: loggedDays,
  };
}
