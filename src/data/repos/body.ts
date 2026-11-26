import { db } from '@/data/db';
import { measurementKey } from '@/domain/catalog';
import type { BodyCompositionEntry, BodyWeightEntry, Goal, MeasurementEntry, MeasurementSite } from '@/domain/models';
import { nowIso, type DayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { round } from '@/lib/numbers';

/** Thrown when an edit would create a second record for the same day. */
export class DuplicateDayError extends Error {
  constructor(public readonly day: DayKey) {
    super(`Já existe um registro em ${day}.`);
  }
}

// ---- Body weight -------------------------------------------------------------
// Rule: one weigh-in per day. Logging again on the same day replaces it.
// The initial weight lives on the weight goal (startValue) and is never
// changed by new weigh-ins. Current weight = most recent weigh-in.

export async function logWeight(input: { day: DayKey; weightKg: number; note?: string }): Promise<{ entry: BodyWeightEntry; replaced: boolean }> {
  return db.transaction('rw', db.bodyWeights, async () => {
    const now = nowIso();
    const sameDay = await db.bodyWeights.where('day').equals(input.day).toArray();
    const existing = sameDay[0];
    const entry: BodyWeightEntry = {
      id: existing?.id ?? newId(),
      day: input.day,
      measuredAt: now,
      weightKg: round(input.weightKg, 2),
      note: input.note?.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.bodyWeights.put(entry);
    // Clean up legacy duplicates for the day, if any.
    if (sameDay.length > 1) await db.bodyWeights.bulkDelete(sameDay.slice(1).map((w) => w.id));
    return { entry, replaced: Boolean(existing) };
  });
}

/** Kept for onboarding and tests: same rule as logWeight. */
export async function addBodyWeight(input: { day: DayKey; weightKg: number; note?: string }): Promise<BodyWeightEntry> {
  return (await logWeight(input)).entry;
}

export async function updateWeight(id: string, patch: { day: DayKey; weightKg: number; note?: string }): Promise<void> {
  await db.transaction('rw', db.bodyWeights, async () => {
    const current = await db.bodyWeights.get(id);
    if (!current) throw new Error('Pesagem não encontrada.');
    const clash = (await db.bodyWeights.where('day').equals(patch.day).toArray()).some((w) => w.id !== id);
    if (clash) throw new DuplicateDayError(patch.day);
    await db.bodyWeights.put({
      ...current,
      day: patch.day,
      weightKg: round(patch.weightKg, 2),
      note: patch.note?.trim() || undefined,
      measuredAt: patch.day === current.day ? current.measuredAt : nowIso(),
      updatedAt: nowIso(),
    });
  });
}

export async function deleteWeight(id: string): Promise<BodyWeightEntry | undefined> {
  const entry = await db.bodyWeights.get(id);
  await db.bodyWeights.delete(id);
  return entry;
}

export async function restoreWeight(entry: BodyWeightEntry): Promise<void> {
  await db.bodyWeights.put(entry);
}

export async function listBodyWeights(from?: DayKey, to?: DayKey): Promise<BodyWeightEntry[]> {
  const coll = from || to ? db.bodyWeights.where('day').between(from ?? '0000-00-00', to ?? '9999-99-99', true, true) : db.bodyWeights.orderBy('day');
  return coll.sortBy('measuredAt');
}

// ---- Body composition --------------------------------------------------------
// One entry per day as well; at least one of body fat / muscle mass.

export type CompositionInput = Pick<BodyCompositionEntry, 'day' | 'bodyFatPct' | 'muscleMassKg' | 'bodyWaterPct' | 'visceralFat' | 'method' | 'note'>;

export async function saveComposition(input: CompositionInput, id?: string): Promise<{ replaced: boolean }> {
  if (input.bodyFatPct === undefined && input.muscleMassKg === undefined) throw new Error('Informe gordura corporal ou massa muscular.');
  return db.transaction('rw', db.bodyComposition, async () => {
    const now = nowIso();
    const sameDay = (await db.bodyComposition.where('day').equals(input.day).toArray()).filter((c) => c.id !== id);
    if (id && sameDay.length) throw new DuplicateDayError(input.day);
    const target = id ? await db.bodyComposition.get(id) : sameDay[0];
    await db.bodyComposition.put({
      id: target?.id ?? newId(),
      day: input.day,
      measuredAt: target && target.day === input.day ? target.measuredAt : now,
      bodyFatPct: input.bodyFatPct === undefined ? undefined : round(input.bodyFatPct, 1),
      muscleMassKg: input.muscleMassKg === undefined ? undefined : round(input.muscleMassKg, 1),
      bodyWaterPct: input.bodyWaterPct === undefined ? undefined : round(input.bodyWaterPct, 1),
      visceralFat: input.visceralFat === undefined ? undefined : round(input.visceralFat, 1),
      method: input.method,
      note: input.note?.trim() || undefined,
      createdAt: target?.createdAt ?? now,
      updatedAt: now,
    });
    return { replaced: !id && Boolean(target) };
  });
}

export async function deleteComposition(id: string): Promise<void> {
  await db.bodyComposition.delete(id);
}

// ---- Measurements ------------------------------------------------------------
// One value per site per day; recording the same site on the same day replaces it.

export interface MeasurementValue {
  site: MeasurementSite;
  customName?: string;
  valueCm: number;
}

export async function saveMeasurements(day: DayKey, values: MeasurementValue[], note?: string): Promise<{ saved: number; replaced: number }> {
  return db.transaction('rw', db.measurements, async () => {
    const now = nowIso();
    const sameDay = await db.measurements.where('day').equals(day).toArray();
    let replaced = 0;
    for (const v of values) {
      const key = measurementKey(v.site, v.customName);
      const existing = sameDay.find((m) => measurementKey(m.site, m.customName) === key);
      if (existing) replaced += 1;
      await db.measurements.put({
        id: existing?.id ?? newId(),
        day,
        measuredAt: now,
        site: v.site,
        customName: v.site === 'custom' ? v.customName?.trim() : undefined,
        valueCm: round(v.valueCm, 1),
        note: note?.trim() || existing?.note,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
    }
    return { saved: values.length, replaced };
  });
}

export async function updateMeasurement(id: string, patch: { day: DayKey; valueCm: number; note?: string }): Promise<void> {
  await db.transaction('rw', db.measurements, async () => {
    const current = await db.measurements.get(id);
    if (!current) throw new Error('Medida não encontrada.');
    const key = measurementKey(current.site, current.customName);
    const clash = (await db.measurements.where('day').equals(patch.day).toArray()).some(
      (m) => m.id !== id && measurementKey(m.site, m.customName) === key,
    );
    if (clash) throw new DuplicateDayError(patch.day);
    await db.measurements.put({
      ...current,
      day: patch.day,
      valueCm: round(patch.valueCm, 1),
      ...(patch.note !== undefined ? { note: patch.note.trim() || undefined } : {}),
      updatedAt: nowIso(),
    });
  });
}

export async function deleteMeasurement(id: string): Promise<void> {
  await db.measurements.delete(id);
}

export async function listMeasurements(): Promise<MeasurementEntry[]> {
  return db.measurements.orderBy('day').toArray();
}

// ---- Primary weight goal (used by onboarding) ----------------------------------

export async function getPrimaryGoal(): Promise<Goal | null> {
  const active = await db.goals.where('status').equals('active').toArray();
  return active.find((g) => g.isPrimary) ?? null;
}

/** Creates or updates the active body-weight goal and makes it primary. */
export async function savePrimaryWeightGoal(input: { startValue: number; targetValue: number; startDate: DayKey; targetDate?: DayKey }): Promise<Goal> {
  return db.transaction('rw', db.goals, async () => {
    const now = nowIso();
    const all = await db.goals.toArray();
    const existing = all.find((g) => g.kind === 'body_weight' && g.status === 'active');
    for (const g of all) {
      if (g.isPrimary && g.id !== existing?.id) await db.goals.update(g.id, { isPrimary: false, updatedAt: now });
    }
    const goal: Goal = {
      ...existing,
      id: existing?.id ?? newId(),
      kind: 'body_weight',
      title: existing?.title ?? 'Peso corporal',
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
