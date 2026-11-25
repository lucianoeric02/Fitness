import { db } from '@/data/db';
import { getSettings, updateSettings } from '@/data/repos/profile';
import { DEFAULT_MEALS, FOOD_CATALOG, foodCatalogId } from '@/domain/foodCatalog';
import type { Food, FoodServing, MealDefinition, Nutrients } from '@/domain/models';
import { nowIso } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { round } from '@/lib/numbers';

// ---- Seeding ------------------------------------------------------------------

/** Installs the starter food catalog once; never reinstalled after removal. */
export async function ensureFoodCatalog(): Promise<number> {
  const settings = await getSettings();
  if (settings.foodsSeeded) return 0;
  const now = nowIso();
  const rows: Food[] = FOOD_CATALOG.map((c) => ({
    id: foodCatalogId(c.key),
    name: c.name,
    category: c.category,
    unit: c.unit,
    preparation: c.preparation,
    per100g: c.per100,
    servings: c.servings.map(([label, grams], i) => ({ id: `${foodCatalogId(c.key)}-s${i}`, label, grams })),
    favorite: false,
    isSeed: true,
    createdAt: now,
    updatedAt: now,
  }));
  await db.transaction('rw', [db.foods, db.settings], async () => {
    const existing = new Set((await db.foods.toArray()).map((f) => f.id));
    await db.foods.bulkAdd(rows.filter((r) => !existing.has(r.id)));
    await updateSettings({ foodsSeeded: true });
  });
  return rows.length;
}

/** Creates the default meals once. */
export async function ensureMeals(): Promise<void> {
  const settings = await getSettings();
  if (settings.mealsSeeded) return;
  const now = nowIso();
  await db.transaction('rw', [db.meals, db.settings], async () => {
    const existing = new Set((await db.meals.toArray()).map((m) => m.id));
    await db.meals.bulkAdd(
      DEFAULT_MEALS.filter((m) => !existing.has(m.id)).map((m, i) => ({ id: m.id, name: m.name, sortOrder: i, hidden: false, createdAt: now, updatedAt: now })),
    );
    await updateSettings({ mealsSeeded: true });
  });
}

export async function ensureNutritionData(): Promise<void> {
  await ensureMeals();
  await ensureFoodCatalog();
}

// ---- Foods ---------------------------------------------------------------------

export type FoodInput = Pick<Food, 'name' | 'category' | 'unit' | 'brand' | 'preparation' | 'per100g' | 'servings'>;

function cleanFood(input: FoodInput): FoodInput {
  const n = input.per100g;
  const per100g: Nutrients = { kcal: round(n.kcal, 1), proteinG: round(n.proteinG, 1), carbsG: round(n.carbsG, 1), fatG: round(n.fatG, 1) };
  if (n.fiberG !== undefined) per100g.fiberG = round(n.fiberG, 1);
  return {
    ...input,
    name: input.name.trim(),
    brand: input.brand?.trim() || undefined,
    preparation: input.preparation?.trim() || undefined,
    per100g,
    servings: input.servings.filter((s) => s.label.trim() && s.grams > 0).map((s) => ({ ...s, label: s.label.trim() })),
  };
}

export async function createFood(input: FoodInput): Promise<Food> {
  const now = nowIso();
  const food: Food = { id: newId(), ...cleanFood(input), favorite: false, isSeed: false, createdAt: now, updatedAt: now };
  await db.foods.add(food);
  return food;
}

/** Editing a food affects future logs only; logged entries keep their snapshot. */
export async function updateFood(id: string, input: FoodInput): Promise<void> {
  const current = await db.foods.get(id);
  if (!current) throw new Error('Alimento não encontrado.');
  await db.foods.put({ ...current, ...cleanFood(input), updatedAt: nowIso() });
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const f = await db.foods.get(id);
  if (!f) return false;
  await db.foods.update(id, { favorite: !f.favorite, updatedAt: nowIso() });
  return !f.favorite;
}

/** Deletes a food; archives it instead when a meal template uses it. Logged entries are snapshots and stay intact. */
export async function removeFood(id: string): Promise<'deleted' | 'archived'> {
  const usedInTemplate = (await db.mealTemplates.toArray()).some((t) => t.items.some((i) => i.foodId === id));
  if (usedInTemplate) {
    await db.foods.update(id, { archivedAt: nowIso(), updatedAt: nowIso() });
    return 'archived';
  }
  await db.foods.delete(id);
  return 'deleted';
}

export async function removeSeedFoods(): Promise<{ deleted: number; archived: number }> {
  let deleted = 0;
  let archived = 0;
  for (const f of (await db.foods.toArray()).filter((x) => x.isSeed && !x.archivedAt)) {
    if ((await removeFood(f.id)) === 'deleted') deleted += 1;
    else archived += 1;
  }
  return { deleted, archived };
}

export function newServing(label: string, grams: number): FoodServing {
  return { id: newId(), label, grams };
}

// ---- Meals ---------------------------------------------------------------------

export async function listMeals(includeHidden = false): Promise<MealDefinition[]> {
  const all = await db.meals.orderBy('sortOrder').toArray();
  return includeHidden ? all : all.filter((m) => !m.hidden);
}

export async function addMeal(name: string): Promise<MealDefinition> {
  const last = await db.meals.orderBy('sortOrder').last();
  const now = nowIso();
  const meal: MealDefinition = { id: newId(), name: name.trim(), sortOrder: (last?.sortOrder ?? -1) + 1, hidden: false, createdAt: now, updatedAt: now };
  await db.meals.add(meal);
  return meal;
}

export async function updateMeal(id: string, patch: Partial<Pick<MealDefinition, 'name' | 'hidden' | 'target'>>): Promise<void> {
  const clean = { ...patch, updatedAt: nowIso() };
  if (patch.name !== undefined) clean.name = patch.name.trim();
  await db.meals.update(id, clean);
}

export async function moveMeal(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.meals, async () => {
    const all = await db.meals.orderBy('sortOrder').toArray();
    const i = all.findIndex((m) => m.id === id);
    const other = all[i + direction];
    if (i < 0 || !other) return;
    await db.meals.update(id, { sortOrder: other.sortOrder });
    await db.meals.update(other.id, { sortOrder: all[i]!.sortOrder });
  });
}

/** Removes a meal category; if it has logged entries it is hidden instead. */
export async function removeMeal(id: string): Promise<'deleted' | 'hidden'> {
  const used = await db.foodEntries.filter((e) => e.slot === id).count();
  if (used > 0) {
    await updateMeal(id, { hidden: true });
    return 'hidden';
  }
  await db.meals.delete(id);
  return 'deleted';
}
