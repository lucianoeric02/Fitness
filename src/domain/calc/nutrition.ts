import type { DayKey } from '@/lib/dates';
import { clamp, round } from '@/lib/numbers';
import type { FoodEntry, Nutrients, NutritionTarget } from '@/domain/models';

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export const ZERO_NUTRIENTS: Readonly<Nutrients> = Object.freeze({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });

/** Nutrients for `grams` of a food whose values are per 100 g. */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: round(per100g.kcal * f, 1),
    proteinG: round(per100g.proteinG * f, 1),
    carbsG: round(per100g.carbsG * f, 1),
    fatG: round(per100g.fatG * f, 1),
    fiberG: round((per100g.fiberG ?? 0) * f, 1),
  };
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
    fiberG: (a.fiberG ?? 0) + (b.fiberG ?? 0),
  };
}

/** Totals for a list of food entries (rounded to 1 decimal to avoid float noise). */
export function sumNutrients(entries: ReadonlyArray<Pick<FoodEntry, 'nutrients'>>): Nutrients {
  const t = entries.reduce<Nutrients>((acc, e) => addNutrients(acc, e.nutrients), { ...ZERO_NUTRIENTS });
  return {
    kcal: round(t.kcal, 1),
    proteinG: round(t.proteinG, 1),
    carbsG: round(t.carbsG, 1),
    fatG: round(t.fatG, 1),
    fiberG: round(t.fiberG ?? 0, 1),
  };
}

/** Calories implied by macros (4/4/9). */
export function caloriesFromMacros(m: Pick<Nutrients, 'proteinG' | 'carbsG' | 'fatG'>): number {
  return m.proteinG * KCAL_PER_G.protein + m.carbsG * KCAL_PER_G.carbs + m.fatG * KCAL_PER_G.fat;
}

/** Share of calories from each macro, 0–1. Returns zeros when there are no macros. */
export function macroCalorieSplit(m: Pick<Nutrients, 'proteinG' | 'carbsG' | 'fatG'>) {
  const total = caloriesFromMacros(m);
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: (m.proteinG * KCAL_PER_G.protein) / total,
    carbs: (m.carbsG * KCAL_PER_G.carbs) / total,
    fat: (m.fatG * KCAL_PER_G.fat) / total,
  };
}

export interface MetricProgress {
  consumed: number;
  target: number;
  remaining: number;
  /** consumed / target, clamped to [0, 1] for rings and bars. */
  ratio: number;
  /** consumed / target, unclamped. */
  rawRatio: number;
  over: boolean;
}

export function metricProgress(consumed: number, target: number): MetricProgress {
  const rawRatio = target > 0 ? consumed / target : 0;
  return {
    consumed,
    target,
    remaining: round(target - consumed, 1),
    ratio: clamp(rawRatio, 0, 1),
    rawRatio,
    over: target > 0 && consumed > target,
  };
}

export interface DailyNutritionProgress {
  kcal: MetricProgress;
  protein: MetricProgress;
  carbs: MetricProgress;
  fat: MetricProgress;
}

export function dailyNutritionProgress(totals: Nutrients, target: Nutrients): DailyNutritionProgress {
  return {
    kcal: metricProgress(totals.kcal, target.kcal),
    protein: metricProgress(totals.proteinG, target.proteinG),
    carbs: metricProgress(totals.carbsG, target.carbsG),
    fat: metricProgress(totals.fatG, target.fatG),
  };
}

/**
 * The target in force on `day`: the one with the latest effectiveFrom <= day.
 * Falls back to the earliest target for days before any target existed.
 */
export function targetForDay<T extends Pick<NutritionTarget, 'effectiveFrom'>>(
  targets: ReadonlyArray<T>,
  day: DayKey,
): T | undefined {
  if (targets.length === 0) return undefined;
  const sorted = [...targets].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
  let found: T | undefined;
  for (const t of sorted) {
    if (t.effectiveFrom <= day) found = t;
    else break;
  }
  return found ?? sorted[0];
}

/**
 * Difference between the stated kcal target and the calories implied by the
 * macro targets. Used to warn when targets are inconsistent.
 */
export function macroTargetMismatch(target: Pick<Nutrients, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>) {
  const fromMacros = caloriesFromMacros(target);
  const diff = fromMacros - target.kcal;
  const pct = target.kcal > 0 ? Math.abs(diff) / target.kcal : 0;
  return { fromMacros: round(fromMacros), diff: round(diff), significant: pct > 0.05 };
}

/**
 * Rescales a logged entry's nutrient snapshot to a new quantity. Uses the
 * snapshot itself (not the current food values), so editing quantity never
 * pulls in later catalog changes.
 */
export function rescaleNutrients(snapshot: Nutrients, fromQty: number, toQty: number): Nutrients {
  if (fromQty <= 0) return { ...ZERO_NUTRIENTS };
  const f = toQty / fromQty;
  return {
    kcal: round(snapshot.kcal * f, 1),
    proteinG: round(snapshot.proteinG * f, 1),
    carbsG: round(snapshot.carbsG * f, 1),
    fatG: round(snapshot.fatG * f, 1),
    fiberG: round((snapshot.fiberG ?? 0) * f, 1),
  };
}

/** Totals per meal id, for the meal breakdown. */
export function totalsByMeal(entries: ReadonlyArray<Pick<FoodEntry, 'slot' | 'nutrients'>>): Map<string, Nutrients> {
  const out = new Map<string, Nutrients>();
  for (const e of entries) out.set(e.slot, sumNutrients([{ nutrients: out.get(e.slot) ?? { ...ZERO_NUTRIENTS } }, e]));
  return out;
}

/** Validates per-100 values of a food. Returns pt-BR message or null. */
export function validateFoodNutrients(n: Nutrients): string | null {
  const vals = [n.kcal, n.proteinG, n.carbsG, n.fatG, n.fiberG ?? 0];
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return 'Os valores nutricionais devem ser números positivos.';
  if (n.kcal > 900) return 'Calorias acima de 900 por 100 g não são realistas.';
  if (n.proteinG + n.carbsG + n.fatG > 100.5) return 'Proteína + carboidratos + gordura não podem passar de 100 g por 100 g.';
  // Note: fiber is NOT capped by carbs — official tables (e.g. TACO avocado) report fiber > carbs due to methodology.
  if ((n.fiberG ?? 0) > 100) return 'Fibras não podem passar de 100 g por 100 g.';
  return null;
}
