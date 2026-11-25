import { db } from '@/data/db';
import type { Goal, GoalKind, GoalStatus, MeasurementSite } from '@/domain/models';
import { nowIso, type DayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';

export interface GoalInput {
  kind: GoalKind;
  title: string;
  unit: string;
  startValue?: number;
  targetValue: number;
  manualCurrentValue?: number;
  targetDate?: DayKey;
  notes?: string;
  ref?: MeasurementSite;
  refName?: string;
}

function clean(input: GoalInput) {
  return {
    kind: input.kind,
    title: input.title.trim(),
    unit: input.unit.trim(),
    startValue: input.startValue,
    targetValue: input.targetValue,
    manualCurrentValue: input.manualCurrentValue,
    targetDate: input.targetDate || undefined,
    notes: input.notes?.trim() || undefined,
    ref: input.kind === 'measurement' ? input.ref : undefined,
    refName: input.kind === 'measurement' && input.ref === 'custom' ? input.refName?.trim() : undefined,
  };
}

/**
 * Guarantees a primary goal when possible: if no active goal is primary,
 * the active body-weight goal is promoted (weight is the default primary).
 */
async function ensurePrimary(): Promise<void> {
  const active = await db.goals.where('status').equals('active').toArray();
  if (active.some((g) => g.isPrimary)) return;
  const weight = active.find((g) => g.kind === 'body_weight');
  if (weight) await db.goals.update(weight.id, { isPrimary: true, updatedAt: nowIso() });
}

export async function listGoals(): Promise<Goal[]> {
  return db.goals.toArray();
}

export async function createGoal(input: GoalInput, today: DayKey, opts: { primary?: boolean } = {}): Promise<Goal> {
  return db.transaction('rw', db.goals, async () => {
    const now = nowIso();
    if (opts.primary) {
      for (const g of await db.goals.toArray()) if (g.isPrimary) await db.goals.update(g.id, { isPrimary: false, updatedAt: now });
    }
    const goal: Goal = { id: newId(), ...clean(input), startDate: today, isPrimary: Boolean(opts.primary), status: 'active', createdAt: now, updatedAt: now };
    await db.goals.add(goal);
    await ensurePrimary();
    return (await db.goals.get(goal.id))!;
  });
}

export async function updateGoal(id: string, input: GoalInput): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    const current = await db.goals.get(id);
    if (!current) throw new Error('Meta não encontrada.');
    await db.goals.put({ ...current, ...clean(input), updatedAt: nowIso() });
  });
}

/** Makes a goal the single primary goal. Only active goals can be primary. */
export async function setPrimaryGoal(id: string): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    const target = await db.goals.get(id);
    if (!target || target.status !== 'active') throw new Error('Só uma meta ativa pode ser a principal.');
    const now = nowIso();
    for (const g of await db.goals.toArray()) {
      if (g.isPrimary !== (g.id === id)) await db.goals.update(g.id, { isPrimary: g.id === id, updatedAt: now });
    }
  });
}

/** Pause, resume or complete a goal. A goal that leaves "active" stops being primary. */
export async function setGoalStatus(id: string, status: GoalStatus): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    const current = await db.goals.get(id);
    if (!current) throw new Error('Meta não encontrada.');
    const now = nowIso();
    await db.goals.put({
      ...current,
      status,
      isPrimary: status === 'active' ? current.isPrimary : false,
      completedAt: status === 'completed' ? now : undefined,
      updatedAt: now,
    });
    await ensurePrimary();
  });
}

export async function deleteGoal(id: string): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    await db.goals.delete(id);
    await ensurePrimary();
  });
}
