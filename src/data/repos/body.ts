import { db } from '@/data/db';
import type { BodyWeightEntry, Goal } from '@/domain/models';
import { nowIso, type DayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { round } from '@/lib/numbers';

export async function addBodyWeight(input: { day: DayKey; weightKg: number; note?: string; measuredAt?: string }): Promise<BodyWeightEntry> {
  const now = nowIso();
  const entry: BodyWeightEntry = {
    id: newId(),
    day: input.day,
    measuredAt: input.measuredAt ?? now,
    weightKg: round(input.weightKg, 2),
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.bodyWeights.add(entry);
  return entry;
}

export async function listBodyWeights(from?: DayKey, to?: DayKey): Promise<BodyWeightEntry[]> {
  const coll = from || to ? db.bodyWeights.where('day').between(from ?? '0000-00-00', to ?? '9999-99-99', true, true) : db.bodyWeights.orderBy('day');
  return coll.sortBy('measuredAt');
}

export async function getPrimaryGoal(): Promise<Goal | null> {
  const active = await db.goals.where('status').equals('active').toArray();
  return active.find((g) => g.isPrimary) ?? null;
}

/** Creates or updates the primary body-weight goal. */
export async function savePrimaryWeightGoal(input: { startValue: number; targetValue: number; startDate: DayKey; targetDate?: DayKey }): Promise<Goal> {
  return db.transaction('rw', db.goals, async () => {
    const now = nowIso();
    const existing = (await db.goals.where('kind').equals('body_weight').toArray()).find((g) => g.isPrimary && g.status === 'active');
    const goal: Goal = {
      id: existing?.id ?? newId(),
      kind: 'body_weight',
      title: 'Peso corporal',
      unit: 'kg',
      startValue: round(input.startValue, 2),
      targetValue: round(input.targetValue, 2),
      startDate: input.startDate,
      targetDate: input.targetDate || undefined,
      isPrimary: true,
      status: 'active',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.goals.put(goal);
    return goal;
  });
}
