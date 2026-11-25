import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackup, restoreBackup, wipeAllData } from './backup';
import { db } from './db';
import {
  deleteMeasurement,
  deleteWeight,
  DuplicateDayError,
  logWeight,
  restoreWeight,
  saveComposition,
  saveMeasurements,
  updateMeasurement,
  updateWeight,
} from './repos/body';
import { createGoal, deleteGoal, setGoalStatus, setPrimaryGoal, updateGoal } from './repos/goals';
import { completeOnboarding } from './repos/onboarding';
import { addWater, deleteWater, lastWaterEntry } from './repos/water';

const TODAY = '2026-11-25';

async function onboard() {
  await completeOnboarding({
    today: '2026-11-01',
    profile: { name: 'Rafael' },
    currentWeightKg: 80,
    targetWeightKg: 86,
    targets: { kcal: 3400, proteinG: 180, carbsG: 450, fatG: 95, waterMl: 4000 },
  });
}

beforeEach(async () => {
  await wipeAllData();
});

describe('weight history', () => {
  it('keeps one weigh-in per day: logging again replaces it', async () => {
    const a = await logWeight({ day: TODAY, weightKg: 81 });
    const b = await logWeight({ day: TODAY, weightKg: 81.4 });
    expect(a.replaced).toBe(false);
    expect(b.replaced).toBe(true);
    expect(b.entry.id).toBe(a.entry.id);
    expect(await db.bodyWeights.count()).toBe(1);
    expect((await db.bodyWeights.get(a.entry.id))?.weightKg).toBe(81.4);
  });

  it('never overwrites the initial weight (goal starting point)', async () => {
    await onboard();
    await logWeight({ day: TODAY, weightKg: 82 });
    const goal = (await db.goals.toArray())[0]!;
    expect(goal.startValue).toBe(80);
    expect(await db.bodyWeights.count()).toBe(2);
  });

  it('edits, refuses date clashes, deletes and restores', async () => {
    const { entry: first } = await logWeight({ day: '2026-11-20', weightKg: 80 });
    await logWeight({ day: '2026-11-21', weightKg: 80.3 });
    await updateWeight(first.id, { day: '2026-11-19', weightKg: 79.8 });
    expect((await db.bodyWeights.get(first.id))?.day).toBe('2026-11-19');
    await expect(updateWeight(first.id, { day: '2026-11-21', weightKg: 79.8 })).rejects.toBeInstanceOf(DuplicateDayError);
    const removed = await deleteWeight(first.id);
    expect(await db.bodyWeights.count()).toBe(1);
    await restoreWeight(removed!);
    expect(await db.bodyWeights.count()).toBe(2);
  });
});

describe('measurements and composition', () => {
  it('stores both sides separately and replaces same site/day', async () => {
    await saveMeasurements('2026-11-20', [
      { site: 'arm_left', valueCm: 39 },
      { site: 'arm_right', valueCm: 39.5 },
      { site: 'custom', customName: 'Ombro', valueCm: 121 },
    ]);
    const again = await saveMeasurements('2026-11-20', [{ site: 'arm_right', valueCm: 39.7 }]);
    expect(again.replaced).toBe(1);
    const all = await db.measurements.toArray();
    expect(all).toHaveLength(3);
    expect(all.find((m) => m.site === 'arm_right')?.valueCm).toBe(39.7);
    expect(all.find((m) => m.site === 'custom')?.customName).toBe('Ombro');
  });

  it('preserves history across dates and supports edit/delete', async () => {
    await saveMeasurements('2026-11-01', [{ site: 'waist', valueCm: 84 }]);
    await saveMeasurements('2026-11-20', [{ site: 'waist', valueCm: 83 }]);
    const [old] = await db.measurements.where('day').equals('2026-11-01').toArray();
    await expect(updateMeasurement(old!.id, { day: '2026-11-20', valueCm: 84 })).rejects.toBeInstanceOf(DuplicateDayError);
    await updateMeasurement(old!.id, { day: '2026-11-02', valueCm: 84.5 });
    expect((await db.measurements.get(old!.id))?.valueCm).toBe(84.5);
    await deleteMeasurement(old!.id);
    expect(await db.measurements.count()).toBe(1);
  });

  it('requires at least one composition value', async () => {
    await expect(saveComposition({ day: TODAY })).rejects.toThrow();
    const r1 = await saveComposition({ day: TODAY, bodyFatPct: 18.24 });
    const r2 = await saveComposition({ day: TODAY, bodyFatPct: 18, muscleMassKg: 36 });
    expect(r1.replaced).toBe(false);
    expect(r2.replaced).toBe(true);
    const [c] = await db.bodyComposition.toArray();
    expect(c).toMatchObject({ bodyFatPct: 18, muscleMassKg: 36 });
  });
});

describe('goals', () => {
  const fatGoal = { kind: 'body_fat' as const, title: 'Gordura', unit: '%', startValue: 18, targetValue: 12 };

  it('weight is the default primary; one primary at a time', async () => {
    await onboard();
    const fat = await createGoal(fatGoal, TODAY);
    let goals = await db.goals.toArray();
    expect(goals.filter((g) => g.isPrimary).map((g) => g.kind)).toEqual(['body_weight']);
    await setPrimaryGoal(fat.id);
    goals = await db.goals.toArray();
    expect(goals.filter((g) => g.isPrimary).map((g) => g.id)).toEqual([fat.id]);
  });

  it('pausing or deleting the primary falls back to the weight goal', async () => {
    await onboard();
    const fat = await createGoal(fatGoal, TODAY, { primary: true });
    await setGoalStatus(fat.id, 'paused');
    expect((await db.goals.get(fat.id))?.isPrimary).toBe(false);
    expect((await db.goals.toArray()).find((g) => g.isPrimary)?.kind).toBe('body_weight');
    await setGoalStatus(fat.id, 'active');
    await setPrimaryGoal(fat.id);
    await deleteGoal(fat.id);
    expect((await db.goals.toArray()).find((g) => g.isPrimary)?.kind).toBe('body_weight');
  });

  it('completes goals with a timestamp and refuses a paused primary', async () => {
    const g = await createGoal({ kind: 'performance', title: 'Supino', unit: 'kg', startValue: 100, targetValue: 120, manualCurrentValue: 105 }, TODAY);
    await setGoalStatus(g.id, 'completed');
    expect((await db.goals.get(g.id))?.completedAt).toBeTruthy();
    await expect(setPrimaryGoal(g.id)).rejects.toThrow();
  });

  it('edits keep the creation date and drop irrelevant refs', async () => {
    const g = await createGoal({ kind: 'measurement', title: 'Braço', unit: 'cm', targetValue: 42, ref: 'arm_right' }, TODAY);
    await updateGoal(g.id, { kind: 'measurement', title: 'Braço direito', unit: 'cm', targetValue: 43, ref: 'arm_right', notes: '  foco  ' });
    const after = await db.goals.get(g.id);
    expect(after).toMatchObject({ title: 'Braço direito', targetValue: 43, startDate: TODAY, notes: 'foco' });
    expect(after?.startValue).toBeUndefined();
  });
});

describe('water', () => {
  it('adds and undoes the most recent entry', async () => {
    await addWater(TODAY, 300);
    await new Promise((r) => setTimeout(r, 2));
    const last = await addWater(TODAY, 500);
    expect((await lastWaterEntry(TODAY))?.id).toBe(last.id);
    await deleteWater(last.id);
    expect((await lastWaterEntry(TODAY))?.amountMl).toBe(300);
  });
});

describe('schema v1 backups', () => {
  it('migrates old goal statuses and kinds on import', async () => {
    const v1 = {
      format: 'iron-track-backup',
      version: 1,
      schemaVersion: 1,
      exportedAt: '2026-11-25T00:00:00Z',
      tables: {
        goals: [
          { id: 'a', kind: 'lift', status: 'achieved', title: 'Supino', unit: 'kg', startValue: 100, targetValue: 120, startDate: TODAY, isPrimary: false },
          { id: 'b', kind: 'custom', status: 'archived', title: 'Corrida', unit: 'min', startValue: 30, targetValue: 25, startDate: TODAY, isPrimary: false },
        ],
      },
    };
    await restoreBackup(parseBackup(JSON.stringify(v1)));
    expect(await db.goals.get('a')).toMatchObject({ kind: 'performance', status: 'completed' });
    expect(await db.goals.get('b')).toMatchObject({ kind: 'conditioning', status: 'paused' });
  });
});
