import { describe, expect, it } from 'vitest';
import { summarizeWeek } from './weekly';

describe('summarizeWeek', () => {
  const base = { today: '2026-11-27', weekStartsOn: 1 as const }; // Friday; week starts Mon 23

  it('counts completed workouts and training days of this week only', () => {
    const s = summarizeWeek({
      ...base,
      sessions: [
        { day: '2026-11-23', status: 'completed' },
        { day: '2026-11-23', status: 'completed' },
        { day: '2026-11-25', status: 'completed' },
        { day: '2026-11-26', status: 'discarded' },
        { day: '2026-11-20', status: 'completed' },
      ],
      foodEntries: [],
    });
    expect(s.weekStart).toBe('2026-11-23');
    expect(s.daysElapsed).toBe(5);
    expect(s.workoutsCompleted).toBe(3);
    expect(s.trainingDays).toBe(2);
    expect(s.workoutsPlanned).toBeNull();
  });

  it('only reports nutrition consistency with enough logged days', () => {
    const two = summarizeWeek({ ...base, sessions: [], foodEntries: [{ day: '2026-11-23' }, { day: '2026-11-24' }, { day: '2026-11-24' }] });
    expect(two.nutrition).toBeNull();
    expect(two.nutritionDaysLogged).toBe(2);
    const three = summarizeWeek({ ...base, sessions: [], foodEntries: [{ day: '2026-11-23' }, { day: '2026-11-24' }, { day: '2026-11-26' }] });
    expect(three.nutrition).toEqual({ daysLogged: 3, daysElapsed: 5, ratio: 0.6 });
  });
});
