import { Capacitor } from '@capacitor/core';

/**
 * Rest-timer alerts.
 * - Native (APK): a local notification is scheduled at the rest end time,
 *   so it fires with the screen off; vibration via Haptics in foreground.
 * - Web: vibration only (navigator.vibrate) while the page is visible.
 * Everything is local; no server involved.
 */
const REST_NOTIFICATION_ID = 4101;

async function plugins() {
  const [{ LocalNotifications }, { Haptics }] = await Promise.all([import('@capacitor/local-notifications'), import('@capacitor/haptics')]);
  return { LocalNotifications, Haptics };
}

const native = () => Capacitor.isNativePlatform();

/** Asks for notification permission (Android 13+). Returns whether alerts can be shown. */
export async function ensureRestAlertPermission(): Promise<boolean> {
  if (!native()) return false;
  try {
    const { LocalNotifications } = await plugins();
    let status = await LocalNotifications.checkPermissions();
    if (status.display === 'prompt' || status.display === 'prompt-with-rationale') status = await LocalNotifications.requestPermissions();
    return status.display === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleRestAlert(endsAt: Date, exerciseName?: string): Promise<void> {
  if (!native()) return;
  try {
    const { LocalNotifications } = await plugins();
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    if (endsAt.getTime() <= Date.now()) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_NOTIFICATION_ID,
          title: 'Descanso concluído',
          body: exerciseName ? `Próxima série: ${exerciseName}` : 'Hora da próxima série.',
          schedule: { at: endsAt, allowWhileIdle: true },
          autoCancel: true,
        },
      ],
    });
  } catch (e) {
    console.warn('Rest alert not scheduled', e);
  }
}

export async function cancelRestAlert(): Promise<void> {
  if (!native()) return;
  try {
    const { LocalNotifications } = await plugins();
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
  } catch {
    // ignore
  }
}

/** Foreground completion feedback. */
export async function restDoneFeedback(): Promise<void> {
  try {
    if (native()) {
      const { Haptics } = await plugins();
      await Haptics.vibrate({ duration: 400 });
    } else {
      navigator.vibrate?.([200, 100, 200]);
    }
  } catch {
    // ignore
  }
}
