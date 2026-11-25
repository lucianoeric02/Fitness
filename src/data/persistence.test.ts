import { beforeEach, describe, expect, it } from 'vitest';
import { BackupError, exportBackup, parseBackup, restoreBackup, wipeAllData } from './backup';
import { db } from './db';
import { addBodyWeight, getPrimaryGoal, savePrimaryWeightGoal } from './repos/body';
import { completeOnboarding } from './repos/onboarding';
import { getProfile, getSettings, updateSettings } from './repos/profile';
import { getTargetForDay, listTargets, setTargetsFrom } from './repos/targets';

const TARGETS = { kcal: 3400, proteinG: 180, carbsG: 450, fatG: 95, waterMl: 4000 };

async function onboard() {
  await completeOnboarding({
    today: '2026-11-25',
    profile: { name: '  Rafael  ', heightCm: 180 },
    currentWeightKg: 80,
    targetWeightKg: 86,
    targets: TARGETS,
  });
}

beforeEach(async () => {
  await wipeAllData();
});

describe('onboarding', () => {
  it('creates profile, settings, targets, first weigh-in and primary goal', async () => {
    await onboard();
    const profile = await getProfile();
    expect(profile?.name).toBe('Rafael');
    expect((await getSettings()).weekStartsOn).toBe(1);
    expect((await getTargetForDay('2026-11-25'))?.kcal).toBe(3400);
    expect(await db.bodyWeights.count()).toBe(1);
    const goal = await getPrimaryGoal();
    expect(goal).toMatchObject({ kind: 'body_weight', startValue: 80, targetValue: 86, isPrimary: true });
  });

  it('is atomic: nothing is written if any step fails', async () => {
    await expect(
      completeOnboarding({
        today: '2026-11-25',
        profile: { name: 'Rafael' },
        currentWeightKg: 80,
        targetWeightKg: 86,
        // @ts-expect-error force a failure inside the transaction
        targets: null,
      }),
    ).rejects.toThrow();
    expect(await getProfile()).toBeNull();
    expect(await db.bodyWeights.count()).toBe(0);
  });
});

describe('versioned nutrition targets', () => {
  it('keeps past days on the target that applied to them', async () => {
    await setTargetsFrom('2026-11-01', TARGETS);
    await setTargetsFrom('2026-11-20', { ...TARGETS, kcal: 3600 });
    expect((await getTargetForDay('2026-11-10'))?.kcal).toBe(3400);
    expect((await getTargetForDay('2026-11-20'))?.kcal).toBe(3600);
    expect((await getTargetForDay('2026-11-25'))?.kcal).toBe(3600);
  });

  it('updates in place when edited twice on the same day', async () => {
    const first = await setTargetsFrom('2026-11-25', TARGETS);
    const second = await setTargetsFrom('2026-11-25', { ...TARGETS, kcal: 3500 });
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(await listTargets()).toHaveLength(1);
  });
});

describe('primary goal', () => {
  it('updates the existing goal instead of duplicating it', async () => {
    await onboard();
    const before = await getPrimaryGoal();
    await savePrimaryWeightGoal({ startValue: 80, startDate: '2026-11-25', targetValue: 88 });
    const after = await getPrimaryGoal();
    expect(after?.id).toBe(before?.id);
    expect(after?.targetValue).toBe(88);
    expect(await db.goals.count()).toBe(1);
  });
});

describe('settings', () => {
  it('merges patches and persists', async () => {
    await updateSettings({ dayStartHour: 3 });
    const s = await getSettings();
    expect(s.dayStartHour).toBe(3);
    expect(s.weekStartsOn).toBe(1);
  });
});

describe('backup', () => {
  it('round-trips all data through export and restore', async () => {
    await onboard();
    await addBodyWeight({ day: '2026-11-26', weightKg: 80.4 });
    const backup = await exportBackup();
    const json = JSON.stringify(backup);

    await wipeAllData();
    expect(await getProfile()).toBeNull();

    const stats = await restoreBackup(parseBackup(json));
    expect(stats.totalRecords).toBe(6); // profile, settings, target, 2 weights, goal
    expect((await getProfile())?.name).toBe('Rafael');
    expect(await db.bodyWeights.count()).toBe(2);
  });

  it('rejects files that are not Iron Track backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ format: 'other' }))).toThrow(/não é um backup/);
    expect(() =>
      parseBackup(JSON.stringify({ format: 'iron-track-backup', version: 1, schemaVersion: 1, exportedAt: '', tables: { hackers: [] } })),
    ).toThrow(/desconhecida/);
    expect(() =>
      parseBackup(JSON.stringify({ format: 'iron-track-backup', version: 1, schemaVersion: 1, exportedAt: '', tables: { foods: [{ name: 'x' }] } })),
    ).toThrow(/sem ID/);
    expect(() => parseBackup(JSON.stringify({ format: 'iron-track-backup', version: 99, schemaVersion: 1, tables: {} }))).toThrow(/mais nova/);
  });

  it('leaves current data intact when a restore fails', async () => {
    await onboard();
    const bad = parseBackup(
      JSON.stringify({
        format: 'iron-track-backup',
        version: 1,
        schemaVersion: 1,
        exportedAt: '',
        // duplicate primary keys make bulkAdd fail mid-transaction
        tables: { profile: [{ id: 'me', name: 'A' }], bodyWeights: [{ id: 'dup' }, { id: 'dup' }] },
      }),
    );
    await expect(restoreBackup(bad)).rejects.toThrow();
    expect((await getProfile())?.name).toBe('Rafael');
    expect(await db.bodyWeights.count()).toBe(1);
  });
});
