import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { entriesForDay, listMealTemplates, recentFoodIds } from '@/data/repos/foodLog';
import { listMeals } from '@/data/repos/foods';
import { sumNutrients, totalsByMeal } from '@/domain/calc/nutrition';
import type { DayKey } from '@/lib/dates';

export function useMeals(includeHidden = false) {
  return useLiveQuery(() => listMeals(includeHidden), [includeHidden]);
}

/** A day's log with totals derived from the entries (never stored). */
export function useDayLog(day: DayKey) {
  return useLiveQuery(async () => {
    const entries = await entriesForDay(day);
    return { entries, totals: sumNutrients(entries), byMeal: totalsByMeal(entries) };
  }, [day]);
}

export function useFoods() {
  return useLiveQuery(() => db.foods.orderBy('name').toArray(), []);
}

export function useRecentFoodIds() {
  return useLiveQuery(() => recentFoodIds(), []);
}

export function useMealTemplates() {
  return useLiveQuery(() => listMealTemplates(), []);
}
