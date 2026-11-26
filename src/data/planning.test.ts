import { beforeEach, describe, expect, it, vi } from 'vitest';
import { wipeAllData } from './backup';
import { db } from './db';
import { createReminder, deleteReminder, ensureDefaultReminders, listReminders, moveTraining, overridesBetween, setDayKind, setDayNote, setTrainingDays, updateReminder } from './repos/planning';
import { getSettings } from './repos/profile';

beforeEach(async () => {
  await wipeAllData();
});

describe('planning repository', () => {
  it('stores the weekly pattern and day overrides; clearing an override removes it', async () => {
    await setTrainingDays([5, 1, 3, 3, 9]);
    expect((await getSettings()).trainingDays).toEqual([1, 3, 5]);
    await setDayKind('2026-11-24', 'training');
    await setDayNote('2026-11-24', ' viagem ');
    expect((await overridesBetween('2026-11-23', '2026-11-29')).get('2026-11-24')).toMatchObject({ kind: 'training', note: 'viagem' });
    await setDayKind('2026-11-24', null);
    await setDayNote('2026-11-24', '');
    expect(await db.dayPlans.count()).toBe(0);
    await moveTraining('2026-11-27', '2026-11-28');
    const o = await overridesBetween('2026-11-23', '2026-11-29');
    expect([o.get('2026-11-27')?.kind, o.get('2026-11-28')?.kind]).toEqual(['rest', 'training']);
  });

  it('creates the 5 default reminders once, all disabled', async () => {
    await ensureDefaultReminders();
    await ensureDefaultReminders();
    const list = await listReminders();
    expect(list.map((r) => r.type)).toEqual(['water', 'workout', 'weigh_in', 'nutrition', 'weekly_review']);
    expect(list.every((r) => !r.enabled)).toBe(true);
  });

  it('toggles, edits, creates and deletes reminders', async () => {
    await ensureDefaultReminders();
    const [water] = await listReminders();
    await updateReminder(water!.id, { enabled: true, time: '09:00' });
    expect(await db.reminders.get(water!.id)).toMatchObject({ enabled: true, time: '09:00' });
    const c = await createReminder({ type: 'custom', title: ' Creatina ', time: '10:00', days: [1, 2] });
    expect(c).toMatchObject({ title: 'Creatina', enabled: true });
    await deleteReminder(c.id);
    expect(await db.reminders.count()).toBe(5);
  });
});

describe('local notifications (native)', () => {
  it('cancels previous reminder notifications and schedules weekly repeats, leaving others alone', async () => {
    vi.resetModules();
    const ln = {
      checkPermissions: vi.fn(async () => ({ display: 'granted' })),
      requestPermissions: vi.fn(),
      getPending: vi.fn(async () => ({ notifications: [{ id: 4101 }, { id: 100_201 }] })),
      cancel: vi.fn(async () => undefined),
      schedule: vi.fn(async () => undefined),
    };
    vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
    vi.doMock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
    const { syncReminderNotifications } = await import('@/services/reminderNotifications');
    const n = await syncReminderNotifications([{ id: 100_100, reminderId: 'r', title: 'Pesagem', body: 'b', weekday: 2, hour: 7, minute: 0, route: '/x' }]);
    expect(n).toBe(1);
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: 100_201 }] }); // rest-timer id 4101 untouched
    expect((ln.schedule.mock.calls as unknown as Array<[{ notifications: unknown[] }]>)[0]![0].notifications[0]).toMatchObject({ id: 100_100, schedule: { on: { weekday: 2, hour: 7, minute: 0 }, allowWhileIdle: true }, extra: { route: '/x' } });
    vi.doUnmock('@capacitor/core');
    vi.doUnmock('@capacitor/local-notifications');
  });

  it('schedules nothing without permission and never prompts on its own', async () => {
    vi.resetModules();
    const ln = {
      checkPermissions: vi.fn(async () => ({ display: 'denied' })),
      requestPermissions: vi.fn(),
      getPending: vi.fn(async () => ({ notifications: [] })),
      cancel: vi.fn(),
      schedule: vi.fn(),
    };
    vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
    vi.doMock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
    const { syncReminderNotifications } = await import('@/services/reminderNotifications');
    expect(await syncReminderNotifications([{ id: 100_100, reminderId: 'r', title: 'x', body: 'b', weekday: 2, hour: 7, minute: 0, route: '/' }])).toBe(0);
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(ln.requestPermissions).not.toHaveBeenCalled();
    vi.doUnmock('@capacitor/core');
    vi.doUnmock('@capacitor/local-notifications');
  });
});
