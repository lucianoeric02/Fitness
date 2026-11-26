import { describe, expect, it } from 'vitest';
import { buildSchedule, plannedKind, planDays, reminderTimes, weekPlanStats } from './planning';
import { dayRange } from '@/lib/dates';
import type { Reminder } from '@/domain/models';

// 2026-11-23 is a Monday.
const WEEK = dayRange('2026-11-23', '2026-11-29');
const MON_WED_FRI = [1, 3, 5];
const templates = [
  { id: 'A', name: 'Treino A', sortOrder: 0, active: true },
  { id: 'B', name: 'Treino B', sortOrder: 1, active: true },
  { id: 'C', name: 'Treino C', sortOrder: 2, active: true },
];
const session = (id: string, day: string, templateId?: string) => ({ id, name: templateId ? `Treino ${templateId}` : 'Livre', day, status: 'completed' as const, templateId, startedAt: `${day}T18:00:00Z` });

describe('weekly plan', () => {
  it('uses overrides before the weekly pattern', () => {
    const o = new Map([['2026-11-24', { kind: 'training' as const }], ['2026-11-25', { kind: 'rest' as const }]]);
    expect(plannedKind('2026-11-23', MON_WED_FRI, o)).toBe('training');
    expect(plannedKind('2026-11-24', MON_WED_FRI, o)).toBe('training');
    expect(plannedKind('2026-11-25', MON_WED_FRI, o)).toBe('rest');
    expect(plannedKind('2026-11-26', undefined, new Map())).toBe('unplanned');
  });

  it('projects the rotation over upcoming training days, after the last completed routine', () => {
    const days = planDays({ days: WEEK, today: '2026-11-25', trainingDays: MON_WED_FRI, overrides: new Map(), sessions: [session('s1', '2026-11-23', 'A')], templates });
    const byDay = Object.fromEntries(days.map((d) => [d.day, d]));
    expect(byDay['2026-11-23']!.completed).toHaveLength(1);
    expect(byDay['2026-11-25']!.routine?.name).toBe('Treino B'); // today, not done yet
    expect(byDay['2026-11-27']!.routine?.name).toBe('Treino C');
    expect(byDay['2026-11-24']!.planned).toBe('rest');
    expect(byDay['2026-11-29']!.routine).toBeUndefined();
  });

  it('does not force days: off-plan sessions count, missed days are stated neutrally', () => {
    const days = planDays({ days: WEEK, today: '2026-11-26', trainingDays: MON_WED_FRI, overrides: new Map(), sessions: [session('s1', '2026-11-24', 'A')], templates });
    const byDay = Object.fromEntries(days.map((d) => [d.day, d]));
    expect(byDay['2026-11-24']!.offPlan).toBe(true);
    expect(byDay['2026-11-23']!.missed).toBe(true);
    expect(byDay['2026-11-27']!.routine?.name).toBe('Treino B');
    expect(weekPlanStats(days, '2026-11-26')).toEqual({ plannedTotal: 3, plannedSoFar: 2, completedSessions: 1, plannedDaysDone: 0 });
  });

  it('starts projecting tomorrow once today is done, and follows date changes', () => {
    const sessions = [session('s1', '2026-11-25', 'A')];
    const d1 = planDays({ days: WEEK, today: '2026-11-25', trainingDays: MON_WED_FRI, overrides: new Map(), sessions, templates });
    expect(d1.find((d) => d.day === '2026-11-27')?.routine?.name).toBe('Treino B');
    const d2 = planDays({ days: WEEK, today: '2026-11-28', trainingDays: MON_WED_FRI, overrides: new Map(), sessions, templates });
    expect(d2.find((d) => d.day === '2026-11-27')?.missed).toBe(true);
    expect(d2.find((d) => d.day === '2026-11-27')?.routine).toBeUndefined();
  });

  it('moving a workout is reflected through overrides', () => {
    const o = new Map([['2026-11-27', { kind: 'rest' as const }], ['2026-11-28', { kind: 'training' as const }]]);
    const days = planDays({ days: WEEK, today: '2026-11-26', trainingDays: MON_WED_FRI, overrides: o, sessions: [], templates });
    expect(days.find((d) => d.day === '2026-11-27')?.planned).toBe('rest');
    expect(days.find((d) => d.day === '2026-11-28')?.routine?.name).toBe('Treino A');
  });
});

describe('reminder schedule', () => {
  const base = { createdAt: '', updatedAt: '', enabled: true } as const;
  const r = (p: Partial<Reminder>): Reminder => ({ id: 'r', type: 'custom', title: 'T', time: '07:00', days: [0, 1, 2, 3, 4, 5, 6], ...base, ...p });

  it('expands water intervals and caps invalid ones', () => {
    expect(reminderTimes({ time: '08:00', intervalMin: 120, endTime: '20:00' })).toHaveLength(7);
    expect(reminderTimes({ time: '08:00' })).toEqual([{ hour: 8, minute: 0 }]);
    expect(reminderTimes({ time: '8h' })).toEqual([]);
    expect(reminderTimes({ time: '08:00', intervalMin: 5, endTime: '20:00' })).toHaveLength(1);
  });

  it('builds weekly notifications only for enabled reminders, with deterministic ids', () => {
    const list = [
      r({ id: 'w', type: 'water', time: '08:00', intervalMin: 240, endTime: '16:00', days: [1] }),
      r({ id: 'x', type: 'workout', time: '18:00', trainingDaysOnly: true }),
      r({ id: 'y', type: 'weigh_in', enabled: false }),
    ];
    const s = buildSchedule(list, [1, 3, 5]);
    expect(s.filter((n) => n.reminderId === 'w').map((n) => [n.weekday, n.hour])).toEqual([
      [2, 8],
      [2, 12],
      [2, 16],
    ]);
    expect(s.filter((n) => n.reminderId === 'x').map((n) => n.weekday)).toEqual([2, 4, 6]);
    expect(s.some((n) => n.reminderId === 'y')).toBe(false);
    expect(new Set(s.map((n) => n.id)).size).toBe(s.length);
    expect(buildSchedule(list, [1, 3, 5]).map((n) => n.id)).toEqual(s.map((n) => n.id));
    expect(s.find((n) => n.reminderId === 'x')?.route).toBe('/treino');
  });
});
