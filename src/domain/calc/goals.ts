import { addDays, daysBetween, type DayKey } from '@/lib/dates';
import { clamp, round } from '@/lib/numbers';
import type { Goal } from '@/domain/models';

export type GoalDirection = 'increase' | 'decrease';

/**
 * Why progress can't be shown:
 * - missing_start / missing_current / missing_target: a value is absent
 * - invalid: a value is not a finite, non-negative number
 * - no_range: initial equals target, so there is no distance to cover
 */
export type GoalProgressIssue = 'missing_start' | 'missing_current' | 'missing_target' | 'invalid' | 'no_range';

export type GoalEvaluation =
  | { ok: false; issue: GoalProgressIssue }
  | {
      ok: true;
      direction: GoalDirection;
      start: number;
      current: number;
      target: number;
      /** Unclamped progress: < 0 when moving away from the target, > 1 beyond it. */
      rawRatio: number;
      /** Progress for display, capped to 0–1. */
      ratio: number;
      /** Signed distance still to cover (target − current); 0 once achieved. */
      remaining: number;
      achieved: boolean;
      /** Current value is on the wrong side of the starting point. */
      regressing: boolean;
    };

function isValidValue(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/**
 * Progress toward a goal.
 *   increasing: (current − initial) / (target − initial)
 *   decreasing: (initial − current) / (initial − target)
 * Returns an issue instead of a number whenever the data can't support an
 * honest progress value.
 */
export function evaluateGoal(start: number | null | undefined, current: number | null | undefined, target: number | null | undefined): GoalEvaluation {
  if (target === null || target === undefined) return { ok: false, issue: 'missing_target' };
  if (start === null || start === undefined) return { ok: false, issue: 'missing_start' };
  if (current === null || current === undefined) return { ok: false, issue: 'missing_current' };
  if (!isValidValue(start) || !isValidValue(current) || !isValidValue(target)) return { ok: false, issue: 'invalid' };
  if (start === target) return { ok: false, issue: 'no_range' };

  const direction: GoalDirection = target > start ? 'increase' : 'decrease';
  const rawRatio = direction === 'increase' ? (current - start) / (target - start) : (start - current) / (start - target);
  const achieved = rawRatio >= 1;
  return {
    ok: true,
    direction,
    start,
    current,
    target,
    rawRatio,
    ratio: clamp(rawRatio, 0, 1),
    remaining: achieved ? 0 : round(target - current, 2),
    achieved,
    regressing: rawRatio < 0,
  };
}

export function goalDirection(goal: Pick<Goal, 'startValue' | 'targetValue'>): GoalDirection | null {
  if (goal.startValue === undefined || goal.startValue === goal.targetValue) return null;
  return goal.targetValue > goal.startValue ? 'increase' : 'decrease';
}

/**
 * Estimated day the goal is reached at the given rate (units per week).
 * Returns null when the rate is zero or moving away from the target.
 */
export function projectGoalDate(remaining: number, ratePerWeek: number | null, from: DayKey): DayKey | null {
  if (ratePerWeek === null || ratePerWeek === 0) return null;
  if (remaining === 0) return from;
  if (Math.sign(remaining) !== Math.sign(ratePerWeek)) return null;
  const days = Math.ceil((remaining / ratePerWeek) * 7);
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

/** User-facing explanation for a progress issue. */
export function goalIssueMessage(issue: GoalProgressIssue): string {
  switch (issue) {
    case 'missing_start':
      return 'Defina o valor inicial para acompanhar o progresso.';
    case 'missing_current':
      return 'Registre um valor atual para acompanhar o progresso.';
    case 'missing_target':
      return 'Defina o valor-alvo.';
    case 'invalid':
      return 'Há um valor inválido nesta meta. Revise os números.';
    case 'no_range':
      return 'O valor inicial é igual ao alvo. Ajuste um dos dois.';
  }
}
