import { db } from '@/data/db';
import { rescaleNutrients, scaleNutrients } from '@/domain/calc/nutrition';
import type { Food, FoodEntry, MealTemplate, MealTemplateItem } from '@/domain/models';
import { nowIso, type DayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { round } from '@/lib/numbers';

export class InvalidQuantityError extends Error {
  constructor() {
    super('Informe uma quantidade maior que zero.');
  }
}

function assertQty(qty: number) {
  if (!Number.isFinite(qty) || qty <= 0 || qty > 5000) throw new InvalidQuantityError();
}

/** Logs a food: nutrients are computed proportionally and stored as a snapshot. */
export async function addFoodEntry(input: { day: DayKey; slot: string; food: Food; quantity: number; servingLabel?: string; note?: string; mealTemplateId?: string }): Promise<FoodEntry> {
  assertQty(input.quantity);
  const now = nowIso();
  const entry: FoodEntry = {
    id: newId(),
    day: input.day,
    slot: input.slot,
    foodId: input.food.id,
    foodName: input.food.name,
    grams: round(input.quantity, 1),
    unit: input.food.unit,
    servingLabel: input.servingLabel,
    nutrients: scaleNutrients(input.food.per100g, input.quantity),
    note: input.note?.trim() || undefined,
    mealTemplateId: input.mealTemplateId,
    loggedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await db.foodEntries.add(entry);
  return entry;
}

/** Edits quantity/meal/note. Nutrients are rescaled from the entry's own snapshot. */
export async function updateFoodEntry(id: string, patch: { quantity?: number; slot?: string; note?: string; servingLabel?: string | null }): Promise<void> {
  await db.transaction('rw', db.foodEntries, async () => {
    const e = await db.foodEntries.get(id);
    if (!e) throw new Error('Registro não encontrado.');
    const next: FoodEntry = { ...e, updatedAt: nowIso() };
    if (patch.quantity !== undefined) {
      assertQty(patch.quantity);
      next.nutrients = rescaleNutrients(e.nutrients, e.grams, patch.quantity);
      next.grams = round(patch.quantity, 1);
    }
    if (patch.slot !== undefined) next.slot = patch.slot;
    if (patch.note !== undefined) next.note = patch.note.trim() || undefined;
    if (patch.servingLabel !== undefined) next.servingLabel = patch.servingLabel ?? undefined;
    await db.foodEntries.put(next);
  });
}

export async function deleteFoodEntry(id: string): Promise<FoodEntry | undefined> {
  const e = await db.foodEntries.get(id);
  await db.foodEntries.delete(id);
  return e;
}

export async function restoreFoodEntry(entry: FoodEntry): Promise<void> {
  await db.foodEntries.put(entry);
}

/** Duplicates an entry (same day/meal by default). */
export async function duplicateFoodEntry(id: string, target?: { day?: DayKey; slot?: string }): Promise<FoodEntry> {
  const e = await db.foodEntries.get(id);
  if (!e) throw new Error('Registro não encontrado.');
  const now = nowIso();
  const copy: FoodEntry = { ...e, id: newId(), day: target?.day ?? e.day, slot: target?.slot ?? e.slot, loggedAt: now, createdAt: now, updatedAt: now };
  await db.foodEntries.add(copy);
  return copy;
}

export async function entriesForDay(day: DayKey): Promise<FoodEntry[]> {
  return (await db.foodEntries.where('day').equals(day).toArray()).sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1));
}

/** Copies all entries of one meal (e.g. yesterday's breakfast) into another day/meal. */
export async function copyMeal(from: { day: DayKey; slot: string }, to: { day: DayKey; slot: string }): Promise<number> {
  const src = (await entriesForDay(from.day)).filter((e) => e.slot === from.slot);
  for (const e of src) await duplicateFoodEntry(e.id, to);
  return src.length;
}

// ---- Meal templates -------------------------------------------------------------

export async function listMealTemplates(): Promise<MealTemplate[]> {
  return (await db.mealTemplates.orderBy('name').toArray()).filter((t) => !t.archivedAt);
}

export async function createMealTemplate(name: string, items: MealTemplateItem[], slot?: string): Promise<MealTemplate> {
  const now = nowIso();
  const t: MealTemplate = { id: newId(), name: name.trim(), slot, items, createdAt: now, updatedAt: now };
  await db.mealTemplates.add(t);
  return t;
}

/** Saves the foods of a logged meal as a reusable template. */
export async function saveMealAsTemplate(day: DayKey, slot: string, name: string): Promise<MealTemplate> {
  const entries = (await entriesForDay(day)).filter((e) => e.slot === slot && e.foodId);
  if (!entries.length) throw new Error('A refeição não tem alimentos do catálogo para salvar.');
  return createMealTemplate(
    name,
    entries.map((e) => ({ foodId: e.foodId!, foodName: e.foodName, grams: e.grams, servingLabel: e.servingLabel })),
    slot,
  );
}

export async function updateMealTemplate(id: string, patch: Partial<Pick<MealTemplate, 'name' | 'items' | 'slot'>>): Promise<void> {
  await db.mealTemplates.update(id, { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}), updatedAt: nowIso() });
}

export async function duplicateMealTemplate(id: string): Promise<MealTemplate> {
  const t = await db.mealTemplates.get(id);
  if (!t) throw new Error('Modelo não encontrado.');
  return createMealTemplate(`${t.name} (cópia)`.slice(0, 40), t.items.map((i) => ({ ...i })), t.slot);
}

export async function deleteMealTemplate(id: string): Promise<void> {
  await db.mealTemplates.delete(id);
}

/**
 * Logs a template into a day/meal using current food values. Items whose
 * food no longer exists are skipped and reported.
 */
export async function applyMealTemplate(id: string, day: DayKey, slot: string): Promise<{ added: number; skipped: string[] }> {
  return db.transaction('rw', [db.mealTemplates, db.foods, db.foodEntries], async () => {
    const t = await db.mealTemplates.get(id);
    if (!t) throw new Error('Modelo não encontrado.');
    let added = 0;
    const skipped: string[] = [];
    for (const item of t.items) {
      const food = await db.foods.get(item.foodId);
      if (!food) {
        skipped.push(item.foodName);
        continue;
      }
      await addFoodEntry({ day, slot, food, quantity: item.grams, servingLabel: item.servingLabel, mealTemplateId: t.id });
      added += 1;
    }
    return { added, skipped };
  });
}

/** Most recently logged foods (unique), newest first. */
export async function recentFoodIds(limit = 15): Promise<string[]> {
  const entries = await db.foodEntries.orderBy('loggedAt').reverse().limit(200).toArray();
  const out: string[] = [];
  for (const e of entries) if (e.foodId && !out.includes(e.foodId)) out.push(e.foodId);
  return out.slice(0, limit);
}
