import { beforeEach, describe, expect, it } from 'vitest';
import { wipeAllData } from './backup';
import { db } from './db';
import {
  addFoodEntry,
  applyMealTemplate,
  copyMeal,
  deleteFoodEntry,
  duplicateFoodEntry,
  duplicateMealTemplate,
  entriesForDay,
  InvalidQuantityError,
  recentFoodIds,
  restoreFoodEntry,
  saveMealAsTemplate,
  updateFoodEntry,
  updateMealTemplate,
} from './repos/foodLog';
import { addMeal, createFood, ensureNutritionData, listMeals, moveMeal, removeFood, removeMeal, removeSeedFoods, toggleFavorite, updateFood, updateMeal } from './repos/foods';
import { updateSettings } from './repos/profile';
import { rescaleNutrients, scaleNutrients, sumNutrients, totalsByMeal, validateFoodNutrients } from '@/domain/calc/nutrition';
import { FOOD_CATALOG, foodCatalogId } from '@/domain/foodCatalog';
import { toDayKey } from '@/lib/dates';

const DAY = '2026-11-25';
const RICE = foodCatalogId('arroz_branco'); // 128 kcal / 100 g
const CHICKEN = foodCatalogId('frango_grelhado');
const MILK = foodCatalogId('leite_integral');

const food = async (id: string) => (await db.foods.get(id))!;

beforeEach(async () => {
  await wipeAllData();
  await ensureNutritionData();
});

describe('proportional calculations', () => {
  it('scales per-100 values: 130 kcal/100 g × 150 g = 195 kcal', () => {
    expect(scaleNutrients({ kcal: 130, proteinG: 2, carbsG: 28, fatG: 0.4 }, 150)).toEqual({ kcal: 195, proteinG: 3, carbsG: 42, fatG: 0.6, fiberG: 0 });
  });

  it('rescales an entry snapshot without consulting the catalog', () => {
    expect(rescaleNutrients({ kcal: 195, proteinG: 3, carbsG: 42, fatG: 0.6 }, 150, 300)).toMatchObject({ kcal: 390, proteinG: 6, carbsG: 84, fatG: 1.2 });
    expect(rescaleNutrients({ kcal: 195, proteinG: 3, carbsG: 42, fatG: 0.6 }, 0, 300).kcal).toBe(0);
  });

  it('validates food values', () => {
    expect(validateFoodNutrients({ kcal: 128, proteinG: 2.5, carbsG: 28.1, fatG: 0.2 })).toBeNull();
    expect(validateFoodNutrients({ kcal: -1, proteinG: 0, carbsG: 0, fatG: 0 })).toMatch(/positivos/);
    expect(validateFoodNutrients({ kcal: 400, proteinG: 60, carbsG: 50, fatG: 10 })).toMatch(/100 g/);
    expect(validateFoodNutrients({ kcal: 950, proteinG: 0, carbsG: 0, fatG: 100 })).toMatch(/900/);
    expect(validateFoodNutrients({ kcal: 96, proteinG: 1.2, carbsG: 6, fatG: 8.4, fiberG: 6.3 })).toBeNull(); // TACO avocado: fiber > carbs is real data
    expect(validateFoodNutrients({ kcal: 50, proteinG: 1, carbsG: 5, fatG: 0, fiberG: 120 })).toMatch(/Fibras/);
  });

  it('every catalog food passes validation and has a reference portion', () => {
    for (const f of FOOD_CATALOG) {
      expect(validateFoodNutrients(f.per100), f.name).toBeNull();
      expect(f.servings.length, f.name).toBeGreaterThan(0);
    }
  });
});

describe('food log', () => {
  it('stores a snapshot; meal and daily totals come from entries', async () => {
    await addFoodEntry({ day: DAY, slot: 'lunch', food: await food(RICE), quantity: 150 });
    await addFoodEntry({ day: DAY, slot: 'lunch', food: await food(CHICKEN), quantity: 120 });
    await addFoodEntry({ day: DAY, slot: 'breakfast', food: await food(MILK), quantity: 200 });
    const entries = await entriesForDay(DAY);
    expect(entries.find((e) => e.foodId === MILK)?.unit).toBe('ml');
    const byMeal = totalsByMeal(entries);
    expect(byMeal.get('lunch')?.kcal).toBe(192 + 190.8);
    expect(byMeal.get('breakfast')?.kcal).toBe(122);
    expect(sumNutrients(entries).kcal).toBe(504.8);
  });

  it('rejects invalid quantities', async () => {
    await expect(addFoodEntry({ day: DAY, slot: 'lunch', food: await food(RICE), quantity: 0 })).rejects.toBeInstanceOf(InvalidQuantityError);
    await expect(addFoodEntry({ day: DAY, slot: 'lunch', food: await food(RICE), quantity: -5 })).rejects.toBeInstanceOf(InvalidQuantityError);
  });

  it('edits quantity (rescaled), moves between meals, duplicates, deletes and restores', async () => {
    const e = await addFoodEntry({ day: DAY, slot: 'lunch', food: await food(RICE), quantity: 100 });
    await updateFoodEntry(e.id, { quantity: 250, slot: 'dinner', note: ' integral ' });
    const edited = await db.foodEntries.get(e.id);
    expect(edited).toMatchObject({ grams: 250, slot: 'dinner', note: 'integral' });
    expect(edited!.nutrients.kcal).toBe(320);
    const dup = await duplicateFoodEntry(e.id);
    expect(dup.id).not.toBe(e.id);
    expect(await db.foodEntries.count()).toBe(2);
    const removed = await deleteFoodEntry(e.id);
    expect(await db.foodEntries.count()).toBe(1);
    await restoreFoodEntry(removed!);
    expect(await db.foodEntries.count()).toBe(2);
  });

  it('keeps history when a food is edited or removed later', async () => {
    const e = await addFoodEntry({ day: DAY, slot: 'lunch', food: await food(RICE), quantity: 100 });
    const rice = await food(RICE);
    await updateFood(RICE, { ...rice, per100g: { ...rice.per100g, kcal: 200 } });
    await removeFood(RICE);
    expect((await db.foodEntries.get(e.id))?.nutrients.kcal).toBe(128);
  });

  it('copies a meal from the previous day', async () => {
    await addFoodEntry({ day: '2026-11-24', slot: 'breakfast', food: await food(MILK), quantity: 300 });
    expect(await copyMeal({ day: '2026-11-24', slot: 'breakfast' }, { day: DAY, slot: 'breakfast' })).toBe(1);
    expect((await entriesForDay(DAY))[0]).toMatchObject({ foodId: MILK, grams: 300, slot: 'breakfast' });
  });

  it('respects the day boundary: late-night entries count for the previous day', async () => {
    await updateSettings({ dayStartHour: 3 });
    const day = toDayKey(new Date(2026, 10, 26, 1, 30), 3);
    expect(day).toBe('2026-11-25');
  });

  it('tracks recent foods', async () => {
    await addFoodEntry({ day: DAY, slot: 'lunch', food: await food(RICE), quantity: 100 });
    await new Promise((r) => setTimeout(r, 2));
    await addFoodEntry({ day: DAY, slot: 'lunch', food: await food(CHICKEN), quantity: 100 });
    await new Promise((r) => setTimeout(r, 2));
    await addFoodEntry({ day: DAY, slot: 'dinner', food: await food(RICE), quantity: 100 });
    expect((await recentFoodIds()).slice(0, 2)).toEqual([RICE, CHICKEN]);
  });
});

describe('meal templates', () => {
  it('saves a meal as template, edits, duplicates and applies to another day', async () => {
    await addFoodEntry({ day: DAY, slot: 'breakfast', food: await food(MILK), quantity: 200 });
    await addFoodEntry({ day: DAY, slot: 'breakfast', food: await food(foodCatalogId('aveia')), quantity: 40, servingLabel: '1/2 xícara' });
    const t = await saveMealAsTemplate(DAY, 'breakfast', 'Café padrão');
    expect(t.items.map((i) => [i.foodName, i.grams])).toEqual([
      ['Leite integral', 200],
      ['Aveia em flocos', 40],
    ]);
    await updateMealTemplate(t.id, { items: t.items.map((i) => (i.foodId === MILK ? { ...i, grams: 300 } : i)) });
    const copy = await duplicateMealTemplate(t.id);
    expect(copy.name).toBe('Café padrão (cópia)');
    const r = await applyMealTemplate(t.id, '2026-11-26', 'breakfast');
    expect(r).toEqual({ added: 2, skipped: [] });
    const day2 = await entriesForDay('2026-11-26');
    expect(day2.find((e) => e.foodId === MILK)?.grams).toBe(300);
    expect(day2.every((e) => e.mealTemplateId === t.id)).toBe(true);
  });

  it('archives foods used in templates instead of deleting', async () => {
    await addFoodEntry({ day: DAY, slot: 'breakfast', food: await food(MILK), quantity: 200 });
    await saveMealAsTemplate(DAY, 'breakfast', 'Leite');
    expect(await removeFood(MILK)).toBe('archived');
    expect(await removeFood(RICE)).toBe('deleted');
  });
});

describe('foods and meals', () => {
  it('creates custom foods, favorites, and keeps seeds removable', async () => {
    const f = await createFood({ name: '  Pão de queijo ', category: 'breads_pasta', unit: 'g', per100g: { kcal: 363, proteinG: 5.1, carbsG: 34.2, fatG: 24.6 }, servings: [{ id: 's', label: '1 unidade', grams: 20 }] });
    expect(f).toMatchObject({ name: 'Pão de queijo', isSeed: false, favorite: false });
    expect(await toggleFavorite(f.id)).toBe(true);
    const r = await removeSeedFoods();
    expect(r.deleted).toBe(FOOD_CATALOG.length);
    expect(await db.foods.count()).toBe(1);
    await ensureNutritionData();
    expect(await db.foods.count()).toBe(1); // never reinstalled
  });

  it('renames, reorders, hides, adds and removes meals', async () => {
    expect((await listMeals()).map((m) => m.name)).toEqual(['Café da manhã', 'Almoço', 'Lanche', 'Pré-treino', 'Pós-treino', 'Jantar', 'Ceia']);
    await updateMeal('afternoon', { name: 'Lanche da tarde', target: { kcal: 400 } });
    await moveMeal('supper', -1);
    const custom = await addMeal('Lanche noturno');
    await updateMeal('pre_workout', { hidden: true });
    const meals = await listMeals();
    expect(meals.map((m) => m.name)).toEqual(['Café da manhã', 'Almoço', 'Lanche da tarde', 'Pós-treino', 'Ceia', 'Jantar', 'Lanche noturno']);
    expect(meals.find((m) => m.id === 'afternoon')?.target?.kcal).toBe(400);
    await addFoodEntry({ day: DAY, slot: custom.id, food: await food(RICE), quantity: 100 });
    expect(await removeMeal(custom.id)).toBe('hidden');
    expect(await removeMeal('dinner')).toBe('deleted');
  });
});
