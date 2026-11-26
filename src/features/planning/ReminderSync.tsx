import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { getSettings } from '@/data/repos/profile';
import { listReminders } from '@/data/repos/planning';
import { buildSchedule } from '@/domain/calc/planning';
import { listenReminderTaps, syncReminderNotifications } from '@/services/reminderNotifications';

/**
 * Keeps OS notifications aligned with the reminder list and weekly pattern,
 * and opens the related screen when a reminder notification is tapped.
 */
export function ReminderSync() {
  const navigate = useNavigate();
  const data = useLiveQuery(async () => ({ reminders: await listReminders(), trainingDays: (await getSettings()).trainingDays }), []);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const schedule = buildSchedule(data.reminders, data.trainingDays);
    const key = JSON.stringify(schedule);
    if (key === lastKey.current) return;
    lastKey.current = key;
    void syncReminderNotifications(schedule).catch((e) => console.warn('Reminder sync failed', e));
  }, [data]);

  useEffect(() => {
    let off: (() => void) | undefined;
    void listenReminderTaps((route) => navigate(route)).then((fn) => (off = fn));
    return () => off?.();
  }, [navigate]);

  return null;
}
