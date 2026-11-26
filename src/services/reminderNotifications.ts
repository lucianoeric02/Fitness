import { Capacitor } from '@capacitor/core';
import type { ScheduledNotification } from '@/domain/calc/planning';

/**
 * Local reminder notifications (no push service, no server). Weekly
 * repeating schedules are rebuilt from the reminder list on every change.
 */
export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

const REMINDER_ID_MIN = 100_000;
const REMINDER_ID_MAX = 999_999;

const native = () => Capacitor.isNativePlatform();
const plugin = async () => (await import('@capacitor/local-notifications')).LocalNotifications;

export async function notificationPermission(): Promise<PermissionState> {
  if (!native()) return 'unsupported';
  try {
    const s = await (await plugin()).checkPermissions();
    return s.display === 'granted' ? 'granted' : s.display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'unsupported';
  }
}

/** Asks the OS once; callers explain why before calling. */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!native()) return 'unsupported';
  try {
    const s = await (await plugin()).requestPermissions();
    return s.display === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Replaces all reminder notifications with the given schedule. Returns how many were scheduled. */
export async function syncReminderNotifications(schedule: ScheduledNotification[]): Promise<number> {
  if (!native()) return 0;
  const ln = await plugin();
  const pending = await ln.getPending();
  const ours = pending.notifications.filter((n) => n.id >= REMINDER_ID_MIN && n.id <= REMINDER_ID_MAX);
  if (ours.length) await ln.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  if (!schedule.length || (await notificationPermission()) !== 'granted') return 0;
  await ln.schedule({
    notifications: schedule.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      schedule: { on: { weekday: n.weekday, hour: n.hour, minute: n.minute }, allowWhileIdle: true },
      extra: { route: n.route },
      autoCancel: true,
    })),
  });
  return schedule.length;
}

/** Opens the screen related to a tapped reminder. */
export async function listenReminderTaps(navigate: (route: string) => void): Promise<() => void> {
  if (!native()) return () => undefined;
  const handle = await (await plugin()).addListener('localNotificationActionPerformed', (e) => {
    const route = (e.notification.extra as { route?: string } | undefined)?.route;
    if (route) navigate(route);
  });
  return () => void handle.remove();
}
