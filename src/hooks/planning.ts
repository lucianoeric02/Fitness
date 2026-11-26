import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { listReminders, overridesBetween } from '@/data/repos/planning';
import { getSettings } from '@/data/repos/profile';
import { listTemplates } from '@/data/repos/templates';
import { planDays } from '@/domain/calc/planning';
import { dayRange, type DayKey } from '@/lib/dates';

/** Day statuses (plan + completed sessions + projected routines) for an inclusive range. */
export function usePlan(from: DayKey, to: DayKey, today: DayKey) {
  return useLiveQuery(async () => {
    const [settings, overrides, sessions, templates] = await Promise.all([
      getSettings(),
      overridesBetween(from, to),
      db.workoutSessions.where('status').equals('completed').toArray(),
      listTemplates(),
    ]);
    return {
      trainingDays: settings.trainingDays,
      weekStartsOn: settings.weekStartsOn,
      days: planDays({ days: dayRange(from, to), today, trainingDays: settings.trainingDays, overrides, sessions, templates }),
    };
  }, [from, to, today]);
}

export function useReminders() {
  return useLiveQuery(() => listReminders(), []);
}
