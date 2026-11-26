import { addDays, dayRange, weekdayOf, type DayKey } from '@/lib/dates';
import type { DayPlan, Reminder, WorkoutSession } from '@/domain/models';
import { nextInRotation } from './workout';

export type PlannedKind = 'training' | 'rest' | 'unplanned';

/** What the plan says for a day: override first, then weekly pattern; 'unplanned' when no pattern exists. */
export function plannedKind(day: DayKey, trainingDays: number[] | undefined, overrides: ReadonlyMap<DayKey, Pick<DayPlan, 'kind'>>): PlannedKind {
  const o = overrides.get(day)?.kind;
  if (o) return o;
  if (!trainingDays) return 'unplanned';
  return trainingDays.includes(weekdayOf(day)) ? 'training' : 'rest';
}

export interface DayStatus {
  day: DayKey;
  planned: PlannedKind;
  completed: Array<Pick<WorkoutSession, 'id' | 'name' | 'templateId'>>;
  /** Projected routine for an upcoming planned training day. */
  routine?: { id: string; name: string };
  note?: string;
  /** Session done on a rest/unplanned day. */
  offPlan: boolean;
  /** Planned training day already in the past with no completed session (stated neutrally). */
  missed: boolean;
}

/**
 * Status for each day in a range. Upcoming planned training days get the
 * routines of the rotation in order, starting after the last completed one.
 * Today counts as upcoming unless a workout was already completed today.
 */
export function planDays(input: {
  days: DayKey[];
  today: DayKey;
  trainingDays: number[] | undefined;
  overrides: ReadonlyMap<DayKey, Pick<DayPlan, 'kind' | 'note'>>;
  sessions: ReadonlyArray<Pick<WorkoutSession, 'id' | 'name' | 'day' | 'status' | 'templateId' | 'startedAt'>>;
  templates: ReadonlyArray<{ id: string; name: string; sortOrder: number; active: boolean }>;
}): DayStatus[] {
  const completed = input.sessions.filter((s) => s.status === 'completed').sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
  const lastTemplate = [...completed].reverse().find((s) => s.templateId)?.templateId;
  const doneToday = completed.some((s) => s.day === input.today);
  // Project the rotation over upcoming planned days (beyond the requested range start if needed).
  const projection = new Map<DayKey, { id: string; name: string }>();
  const lastDay = input.days[input.days.length - 1];
  if (lastDay && lastDay >= input.today) {
    let prev = lastTemplate;
    for (const d of dayRange(doneToday ? addDays(input.today, 1) : input.today, lastDay)) {
      if (plannedKind(d, input.trainingDays, input.overrides) !== 'training') continue;
      const t = nextInRotation(input.templates, prev);
      if (!t) break;
      projection.set(d, { id: t.id, name: t.name });
      prev = t.id;
    }
  }
  return input.days.map((day) => {
    const planned = plannedKind(day, input.trainingDays, input.overrides);
    const done = completed.filter((s) => s.day === day);
    return {
      day,
      planned,
      completed: done.map((s) => ({ id: s.id, name: s.name, templateId: s.templateId })),
      routine: projection.get(day),
      note: input.overrides.get(day)?.note,
      offPlan: done.length > 0 && planned !== 'training',
      missed: planned === 'training' && done.length === 0 && day < input.today,
    };
  });
}

export interface WeekPlanStats {
  plannedTotal: number;
  /** Planned training days up to and including today. */
  plannedSoFar: number;
  completedSessions: number;
  /** Planned days (so far) that have at least one completed session. */
  plannedDaysDone: number;
}

export function weekPlanStats(statuses: ReadonlyArray<DayStatus>, today: DayKey): WeekPlanStats {
  const planned = statuses.filter((s) => s.planned === 'training');
  const soFar = planned.filter((s) => s.day <= today);
  return {
    plannedTotal: planned.length,
    plannedSoFar: soFar.length,
    completedSessions: statuses.reduce((a, s) => a + s.completed.length, 0),
    plannedDaysDone: soFar.filter((s) => s.completed.length > 0).length,
  };
}

// ---- Reminders → notification schedule ---------------------------------------------

export interface ScheduledNotification {
  id: number;
  reminderId: string;
  title: string;
  body: string;
  /** Capacitor weekday: 1 = Sunday … 7 = Saturday. */
  weekday: number;
  hour: number;
  minute: number;
  route: string;
}

const BODIES: Record<Reminder['type'], { body: string; route: string }> = {
  water: { body: 'Hora de beber água. Toque para registrar.', route: '/mais/hidratacao' },
  workout: { body: 'Dia de treino planejado. Bora?', route: '/treino' },
  weigh_in: { body: 'Pesagem: registre seu peso de hoje.', route: '/mais/perfil/peso' },
  nutrition: { body: 'Registre suas refeições de hoje.', route: '/nutricao' },
  weekly_review: { body: 'Sua revisão semanal está pronta.', route: '/mais/planejamento/revisao' },
  custom: { body: 'Lembrete do Iron Track.', route: '/' },
};

export function parseTime(t: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** Times of the day for a reminder (water may repeat on an interval). */
export function reminderTimes(r: Pick<Reminder, 'time' | 'intervalMin' | 'endTime'>): Array<{ hour: number; minute: number }> {
  const start = parseTime(r.time);
  if (!start) return [];
  if (!r.intervalMin || !r.endTime) return [start];
  const end = parseTime(r.endTime);
  if (!end || r.intervalMin < 30) return [start];
  const out: Array<{ hour: number; minute: number }> = [];
  for (let t = start.hour * 60 + start.minute; t <= end.hour * 60 + end.minute && out.length < 24; t += r.intervalMin) out.push({ hour: Math.floor(t / 60), minute: t % 60 });
  return out;
}

/**
 * Weekly repeating local notifications for all enabled reminders. IDs are
 * deterministic per reminder so a resync replaces them cleanly.
 */
export function buildSchedule(reminders: ReadonlyArray<Reminder>, trainingDays: number[] | undefined): ScheduledNotification[] {
  const out: ScheduledNotification[] = [];
  reminders.forEach((r, ri) => {
    if (!r.enabled) return;
    const days = r.type === 'workout' && r.trainingDaysOnly && trainingDays ? r.days.filter((d) => trainingDays.includes(d)) : r.days;
    const times = reminderTimes(r);
    for (const d of [...new Set(days)].sort()) {
      times.forEach((t, ti) => {
        out.push({
          id: 100_000 + ri * 1000 + d * 100 + ti,
          reminderId: r.id,
          title: r.title,
          body: BODIES[r.type].body,
          weekday: d + 1,
          hour: t.hour,
          minute: t.minute,
          route: BODIES[r.type].route,
        });
      });
    }
  });
  return out;
}
