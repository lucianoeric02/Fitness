import { db } from '@/data/db';
import type { WaterEntry } from '@/domain/models';
import { nowIso, type DayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';

export async function addWater(day: DayKey, amountMl: number): Promise<WaterEntry> {
  const now = nowIso();
  const entry: WaterEntry = { id: newId(), day, amountMl: Math.round(amountMl), loggedAt: now, createdAt: now, updatedAt: now };
  await db.waterEntries.add(entry);
  return entry;
}

export async function lastWaterEntry(day: DayKey): Promise<WaterEntry | undefined> {
  const entries = await db.waterEntries.where('day').equals(day).sortBy('loggedAt');
  return entries[entries.length - 1];
}

export async function deleteWater(id: string): Promise<void> {
  await db.waterEntries.delete(id);
}
