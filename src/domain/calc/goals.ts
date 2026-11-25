import { addDays, daysBetween, type DayKey } from '@/lib/dates';
import { clamp, round } from '@/lib/numbers';
import type { Goal } from '@/domain/models';

export type GoalDirection = 'increase' | 'decrease' | 'maintain';

export function goalDirection(goal: Pick<Goal, 'startValue' | 'targetValue'>): GoalDirection {
  if (goal.targetValue > goal.startValue) return 'increase';
  if (goal.targetValue < goal.startValue) return 'decrease';
  return 'maintain';
}

export interface GoalProgress {
  direction: GoalDirection;
  current: number;
  /** Progress from start toward target, clamped 0–1. */
  ratio: number;
  /** Signed distance still to cover (target − current). */
  remaining: number;
  achieved: boolean;
}

/**
 * Progress of a goal given its current value. Works for both gain goals
 * (e.g. body weight 78 → 85 kg) and loss goals (e.g. waist 90 → 84 cm).
 */
export function goalProgress(goal: Pick<Goal, 'startValue' | 'targetValue'>, current: number): GoalProgress {
  const direction = goalDirection(goal);
  const span = goal.targetValue - goal.startValue;
  const remaining = round(goal.targetValue - current, 2);
  if (direction === 'maintain') {
    return { direction, current, ratio: 1, remaining, achieved: Math.abs(remaining) < 1e-9 };
  }
  const ratio = clamp((current - goal.startValue) / span, 0, 1);
  const achieved = direction === 'increase' ? current >= goal.targetValue : current <= goal.targetValue;
  return { direction, current, ratio, remaining, achieved };
}

/**
 * Estimated day the goal is reached at the given rate (units per week).
 * Returns null when the rate is zero or moving away from the target.
 */
export function projectGoalDate(remaining: number, ratePerWeek: number | null, from: DayKey): DayKey | null {
  if (ratePerWeek === null || ratePerWeek === 0) return null;
  if (remaining === 0) return from;
  if (Math.sign(remaining) !== Math.sign(ratePerWeek)) return null;
  const weeks = remaining / ratePerWeek;
  const days = Math.ceil(weeks * 7);
  if (days > 3650) return null;
  return addDays(from, days);
}

/** Weekly rate needed to reach the target by its target date. */
export function requiredWeeklyRate(goal: Pick<Goal, 'targetValue' | 'targetDate'>, current: number, today: DayKey): number | null {
  if (!goal.targetDate) return null;
  const days = daysBetween(today, goal.targetDate);
  if (days <= 0) return null;
  return round(((goal.targetValue - current) / days) * 7, 2);
}
