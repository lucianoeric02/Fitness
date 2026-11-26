import { db } from '@/data/db';
import type { WaterEntry } from '@/domain/models';
import { nowIso, type DayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';

export const WATER_MIN_ML = 10;
export const WATER_MAX_ML = 3000;

export class InvalidWaterAmountError extends Error {
  constructor() {
    super(`Informe entre ${WATER_MIN_ML} e ${WATER_MAX_ML} ml.`);
  }
}

function assertAmount(ml: number) {
  if (!Number.isFinite(ml) || !Number.isInteger(ml) || ml < WATER_MIN_ML || ml > WATER_MAX_ML) throw new InvalidWaterAmountError();
}

/** Strictly increasing timestamps so quick taps keep their order. */
let lastMs = 0;
function nextIso(): string {
  lastMs = Math.max(Date.now(), lastMs + 1);
  return new Date(lastMs).toISOString();
}

export async function addWater(day: DayKey, amountMl: number, note?: string): Promise<WaterEntry> {
  const ml = Math.round(amountMl);
  assertAmount(ml);
  const now = nextIso();
  const entry: WaterEntry = { id: newId(), day, amountMl: ml, loggedAt: now, note: note?.trim() || undefined, createdAt: now, updatedAt: now };
  await db.waterEntries.add(entry);
  return entry;
}

export async function updateWater(id: string, patch: { amountMl?: number; note?: string; loggedAt?: string }): Promise<void> {
  const e = await db.waterEntries.get(id);
  if (!e) throw new Error('Registro não encontrado.');
  const next: WaterEntry = { ...e, updatedAt: nowIso() };
  if (patch.amountMl !== undefined) {
    const ml = Math.round(patch.amountMl);
    assertAmount(ml);
    next.amountMl = ml;
  }
  if (patch.note !== undefined) next.note = patch.note.trim() || undefined;
  if (patch.loggedAt !== undefined) next.loggedAt = patch.loggedAt;
  await db.waterEntries.put(next);
}

export async function lastWaterEntry(day: DayKey): Promise<WaterEntry | undefined> {
  const entries = await db.waterEntries.where('day').equals(day).sortBy('loggedAt');
  return entries[entries.length - 1];
}

export async function waterEntriesForDay(day: DayKey): Promise<WaterEntry[]> {
  return db.waterEntries.where('day').equals(day).sortBy('loggedAt');
}

export async function deleteWater(id: string): Promise<WaterEntry | undefined> {
  const e = await db.waterEntries.get(id);
  await db.waterEntries.delete(id);
  return e;
}

export async function restoreWater(entry: WaterEntry): Promise<void> {
  await db.waterEntries.put(entry);
}

export async function waterBetween(from: DayKey, to: DayKey): Promise<WaterEntry[]> {
  return db.waterEntries.where('day').between(from, to, true, true).toArray();
}
