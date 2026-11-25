import { db } from '@/data/db';
import { targetForDay } from '@/domain/calc/nutrition';
import type { NutritionTarget } from '@/domain/models';
import { nowIso, type DayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';

export type TargetValues = Pick<NutritionTarget, 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'waterMl'>;

export const DEFAULT_TARGETS: TargetValues = {
  kcal: 3400,
  proteinG: 180,
  carbsG: 450,
  fatG: 95,
  waterMl: 4000,
};

export async function listTargets(): Promise<NutritionTarget[]> {
  return db.nutritionTargets.orderBy('effectiveFrom').toArray();
}

export async function getTargetForDay(day: DayKey): Promise<NutritionTarget | null> {
  return targetForDay(await listTargets(), day) ?? null;
}

/**
 * Sets targets starting on `from`. If a target already starts that day it is
 * updated in place; otherwise a new version is created. Earlier days keep
 * the targets that applied to them. Later versions are left untouched.
 */
export async function setTargetsFrom(from: DayKey, values: TargetValues): Promise<NutritionTarget> {
  return db.transaction('rw', db.nutritionTargets, async () => {
    const now = nowIso();
    const sameDay = await db.nutritionTargets.where('effectiveFrom').equals(from).first();
    const record: NutritionTarget = {
      id: sameDay?.id ?? newId(),
      effectiveFrom: from,
      kcal: Math.round(values.kcal),
      proteinG: values.proteinG,
      carbsG: values.carbsG,
      fatG: values.fatG,
      waterMl: Math.round(values.waterMl),
      createdAt: sameDay?.createdAt ?? now,
      updatedAt: now,
    };
    await db.nutritionTargets.put(record);
    return record;
  });
}
