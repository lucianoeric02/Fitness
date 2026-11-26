import { beforeEach, describe, expect, it } from 'vitest';
import { wipeAllData } from './backup';
import { db, DB_NAME, IronTrackDB } from './db';
import { addWater, deleteWater, InvalidWaterAmountError, lastWaterEntry, restoreWater, updateWater, waterBetween, waterEntriesForDay } from './repos/water';
import { dailyWaterTotals, daysOnTarget, sumWater, waterProgress } from '@/domain/calc/water';
import { toDayKey } from '@/lib/dates';

const DAY = '2026-11-25';

beforeEach(async () => {
  await wipeAllData();
});

describe('hydration', () => {
  it('quick-adds and custom amounts sum into the daily total (derived from entries)', async () => {
    await addWater(DAY, 200);
    await addWater(DAY, 300);
    await addWater(DAY, 500);
    await addWater(DAY, 750, ' garrafa ');
    const entries = await waterEntriesForDay(DAY);
    expect(entries.map((e) => e.amountMl)).toEqual([200, 300, 500, 750]); // order kept even within the same ms
    expect(entries[3]!.note).toBe('garrafa');
    expect(sumWater(entries)).toBe(1750);
    const p = waterProgress(entries, 4000);
    expect(p.remaining).toBe(2250);
    expect(Math.round(p.rawRatio * 100)).toBe(44);
  });

  it('rejects invalid amounts', async () => {
    await expect(addWater(DAY, 0)).rejects.toBeInstanceOf(InvalidWaterAmountError);
    await expect(addWater(DAY, 5)).rejects.toBeInstanceOf(InvalidWaterAmountError);
    await expect(addWater(DAY, 5000)).rejects.toBeInstanceOf(InvalidWaterAmountError);
    await expect(addWater(DAY, Number.NaN)).rejects.toBeInstanceOf(InvalidWaterAmountError);
  });

  it('undoes the most recent entry and can redo it', async () => {
    await addWater(DAY, 300);
    const last = await addWater(DAY, 500);
    expect((await lastWaterEntry(DAY))?.id).toBe(last.id);
    const removed = await deleteWater(last.id);
    expect(sumWater(await waterEntriesForDay(DAY))).toBe(300);
    await restoreWater(removed!);
    expect(sumWater(await waterEntriesForDay(DAY))).toBe(800);
  });

  it('edits amount, time and note; refuses invalid edits', async () => {
    const e = await addWater(DAY, 300);
    const at = new Date(2026, 10, 25, 7, 45).toISOString();
    await updateWater(e.id, { amountMl: 450, note: 'café', loggedAt: at });
    expect(await db.waterEntries.get(e.id)).toMatchObject({ amountMl: 450, note: 'café', loggedAt: at, day: DAY });
    await expect(updateWater(e.id, { amountMl: -1 })).rejects.toBeInstanceOf(InvalidWaterAmountError);
  });

  it('builds per-day history including empty days and counts days on target', async () => {
    await addWater('2026-11-23', 2000);
    await addWater('2026-11-23', 2000);
    await addWater('2026-11-25', 1500);
    await addWater('2026-11-26', 999); // outside range
    const days = dailyWaterTotals(await waterBetween('2026-11-22', '2026-11-25'), '2026-11-22', '2026-11-25');
    expect(days.map((d) => [d.day, d.totalMl])).toEqual([
      ['2026-11-22', 0],
      ['2026-11-23', 4000],
      ['2026-11-24', 0],
      ['2026-11-25', 1500],
    ]);
    expect(daysOnTarget(days, 4000)).toBe(1);
  });

  it('uses local calendar days, honouring the day-start hour', () => {
    expect(toDayKey(new Date(2026, 10, 26, 0, 30))).toBe('2026-11-26');
    expect(toDayKey(new Date(2026, 10, 26, 0, 30), 2)).toBe('2026-11-25');
  });

  it('persists across a database reopen', async () => {
    await addWater(DAY, 500, 'treino');
    db.close();
    const reopened = new IronTrackDB(DB_NAME);
    await reopened.open();
    expect(await reopened.waterEntries.where('day').equals(DAY).toArray()).toMatchObject([{ amountMl: 500, note: 'treino' }]);
    reopened.close();
    await db.open();
  });
});
