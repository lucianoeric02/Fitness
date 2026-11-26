import { db } from '@/data/db';
import { getSettings, updateSettings } from '@/data/repos/profile';
import type { DayPlan, Reminder } from '@/domain/models';
import { nowIso, type DayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';

// ---- Weekly pattern & day overrides -----------------------------------------------------

export async function setTrainingDays(days: number[] | undefined): Promise<void> {
  await updateSettings({ trainingDays: days ? [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort() : undefined });
}

/** Toggles one weekday, reading the current pattern at write time (safe for quick consecutive taps). */
export async function toggleTrainingDay(weekday: number): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = new Set((await getSettings()).trainingDays ?? []);
    if (current.has(weekday)) current.delete(weekday);
    else current.add(weekday);
    await setTrainingDays([...current]);
  });
}

async function upsertDay(day: DayKey, patch: Partial<Pick<DayPlan, 'kind' | 'note'>>): Promise<void> {
  const now = nowIso();
  const current = await db.dayPlans.get(day);
  const next: DayPlan = { id: day, day, createdAt: current?.createdAt ?? now, updatedAt: now, kind: current?.kind, note: current?.note, ...patch };
  if (!next.kind && !next.note) await db.dayPlans.delete(day);
  else await db.dayPlans.put(next);
}

/** Overrides one day (null = follow the weekly pattern again). */
export async function setDayKind(day: DayKey, kind: 'training' | 'rest' | null): Promise<void> {
  await upsertDay(day, { kind: kind ?? undefined });
}

export async function setDayNote(day: DayKey, note: string): Promise<void> {
  await upsertDay(day, { note: note.trim() || undefined });
}

/** Moves a planned workout from one day to another (reschedule). */
export async function moveTraining(from: DayKey, to: DayKey): Promise<void> {
  await db.transaction('rw', db.dayPlans, async () => {
    await setDayKind(from, 'rest');
    await setDayKind(to, 'training');
  });
}

export async function overridesBetween(from: DayKey, to: DayKey): Promise<Map<DayKey, DayPlan>> {
  const rows = await db.dayPlans.where('day').between(from, to, true, true).toArray();
  return new Map(rows.map((r) => [r.day, r]));
}

// ---- Reminders --------------------------------------------------------------------------------

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** The five default reminders, created disabled once. */
export async function ensureDefaultReminders(): Promise<void> {
  const settings = await getSettings();
  if (settings.remindersSeeded) return;
  const t0 = Date.now();
  const now = new Date(t0).toISOString();
  const base = { enabled: false, createdAt: now, updatedAt: now };
  const defaults: Reminder[] = [
    { id: newId(), type: 'water', title: 'Beber água', time: '08:00', endTime: '20:00', intervalMin: 120, days: ALL_DAYS, ...base },
    { id: newId(), type: 'workout', title: 'Treino', time: '18:00', days: ALL_DAYS, trainingDaysOnly: true, ...base },
    { id: newId(), type: 'weigh_in', title: 'Pesagem', time: '07:00', days: ALL_DAYS, ...base },
    { id: newId(), type: 'nutrition', title: 'Registrar refeições', time: '21:00', days: ALL_DAYS, ...base },
    { id: newId(), type: 'weekly_review', title: 'Revisão semanal', time: '19:00', days: [0], ...base },
  ];
  await db.transaction('rw', [db.reminders, db.settings], async () => {
    // Strictly increasing creation times keep a stable display order (and stable notification ids).
    if ((await db.reminders.count()) === 0) await db.reminders.bulkAdd(defaults.map((r, i) => ({ ...r, createdAt: new Date(t0 + i).toISOString() })));
    await updateSettings({ remindersSeeded: true });
  });
}

export async function listReminders(): Promise<Reminder[]> {
  return (await db.reminders.toArray()).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
}

export type ReminderInput = Pick<Reminder, 'type' | 'title' | 'time' | 'days' | 'intervalMin' | 'endTime' | 'trainingDaysOnly'>;

export async function createReminder(input: ReminderInput): Promise<Reminder> {
  const now = nowIso();
  const r: Reminder = { id: newId(), ...input, title: input.title.trim(), enabled: true, createdAt: now, updatedAt: now };
  await db.reminders.add(r);
  return r;
}

export async function updateReminder(id: string, patch: Partial<ReminderInput & { enabled: boolean }>): Promise<void> {
  await db.reminders.update(id, { ...patch, ...(patch.title !== undefined ? { title: patch.title.trim() } : {}), updatedAt: nowIso() });
}

export async function deleteReminder(id: string): Promise<void> {
  await db.reminders.delete(id);
}
