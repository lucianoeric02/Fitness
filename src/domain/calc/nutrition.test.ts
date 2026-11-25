import { describe, expect, it } from 'vitest';
import {
  caloriesFromMacros,
  dailyNutritionProgress,
  macroCalorieSplit,
  macroTargetMismatch,
  metricProgress,
  scaleNutrients,
  sumNutrients,
  targetForDay,
} from './nutrition';

const rice = { kcal: 128, proteinG: 2.5, carbsG: 28.1, fatG: 0.2, fiberG: 1.6 };

describe('nutrition calculations', () => {
  it('scales per-100g values to a portion', () => {
    expect(scaleNutrients(rice, 250)).toEqual({ kcal: 320, proteinG: 6.3, carbsG: 70.3, fatG: 0.5, fiberG: 4 });
    expect(scaleNutrients(rice, 0).kcal).toBe(0);
  });

  it('sums entries without float noise', () => {
    const entries = [0.1, 0.2].map((kcal) => ({ nutrients: { kcal, proteinG: 0.1, carbsG: 0.2, fatG: 0 } }));
    expect(sumNutrients(entries)).toEqual({ kcal: 0.3, proteinG: 0.2, carbsG: 0.4, fatG: 0, fiberG: 0 });
    expect(sumNutrients([]).kcal).toBe(0);
  });

  it('computes macro calories and split', () => {
    const m = { proteinG: 180, carbsG: 450, fatG: 95 };
    expect(caloriesFromMacros(m)).toBe(180 * 4 + 450 * 4 + 95 * 9);
    const split = macroCalorieSplit(m);
    expect(split.protein + split.carbs + split.fat).toBeCloseTo(1);
    expect(macroCalorieSplit({ proteinG: 0, carbsG: 0, fatG: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });

  it('flags inconsistent targets only beyond 5%', () => {
    expect(macroTargetMismatch({ kcal: 3400, proteinG: 180, carbsG: 450, fatG: 95 }).significant).toBe(false);
    expect(macroTargetMismatch({ kcal: 3400, proteinG: 150, carbsG: 300, fatG: 60 }).significant).toBe(true);
  });

  it('computes progress including overshoot', () => {
    const p = metricProgress(3600, 3400);
    expect(p.ratio).toBe(1);
    expect(p.over).toBe(true);
    expect(p.remaining).toBe(-200);
    expect(metricProgress(100, 0).ratio).toBe(0);
    const d = dailyNutritionProgress({ kcal: 1700, proteinG: 90, carbsG: 225, fatG: 47.5 }, { kcal: 3400, proteinG: 180, carbsG: 450, fatG: 95 });
    expect(d.kcal.ratio).toBe(0.5);
    expect(d.protein.remaining).toBe(90);
  });

  it('resolves the target in force on a given day', () => {
    const targets = [
      { id: 'b', effectiveFrom: '2026-11-10' },
      { id: 'a', effectiveFrom: '2026-11-01' },
      { id: 'c', effectiveFrom: '2026-11-20' },
    ];
    expect(targetForDay(targets, '2026-11-15')?.id).toBe('b');
    expect(targetForDay(targets, '2026-11-20')?.id).toBe('c');
    expect(targetForDay(targets, '2026-12-31')?.id).toBe('c');
    expect(targetForDay(targets, '2026-10-01')?.id).toBe('a');
    expect(targetForDay([], '2026-10-01')).toBeUndefined();
  });
});
