import { describe, expect, it } from 'vitest';
import { evaluateGoal, goalIssueMessage, projectGoalDate, requiredWeeklyRate } from './goals';

describe('evaluateGoal', () => {
  it('increasing goals: (current − initial) / (target − initial)', () => {
    const e = evaluateGoal(78, 81.5, 85);
    expect(e.ok && e.direction).toBe('increase');
    expect(e.ok && e.ratio).toBeCloseTo(0.5);
    expect(e.ok && e.remaining).toBe(3.5);
  });

  it('decreasing goals: (initial − current) / (initial − target)', () => {
    const e = evaluateGoal(20, 17, 14); // body fat 20% → 14%
    expect(e.ok && e.direction).toBe('decrease');
    expect(e.ok && e.ratio).toBeCloseTo(0.5);
    expect(e.ok && e.remaining).toBe(-3);
  });

  it('caps visual progress at 100% but keeps the real value', () => {
    const e = evaluateGoal(78, 87, 85);
    expect(e.ok && e.ratio).toBe(1);
    expect(e.ok && e.rawRatio).toBeCloseTo(9 / 7);
    expect(e.ok && e.current).toBe(87);
    expect(e.ok && e.achieved).toBe(true);
    expect(e.ok && e.remaining).toBe(0);
  });

  it('flags reversed movement instead of showing negative progress', () => {
    const e = evaluateGoal(78, 76, 85);
    expect(e.ok && e.ratio).toBe(0);
    expect(e.ok && e.regressing).toBe(true);
    const d = evaluateGoal(90, 92, 84);
    expect(d.ok && d.regressing).toBe(true);
  });

  it('refuses to compute with incomplete or invalid data', () => {
    expect(evaluateGoal(undefined, 80, 85)).toEqual({ ok: false, issue: 'missing_start' });
    expect(evaluateGoal(78, null, 85)).toEqual({ ok: false, issue: 'missing_current' });
    expect(evaluateGoal(78, 80, undefined)).toEqual({ ok: false, issue: 'missing_target' });
    expect(evaluateGoal(80, 80, 80)).toEqual({ ok: false, issue: 'no_range' }); // zero denominator
    expect(evaluateGoal(-5, 80, 85)).toEqual({ ok: false, issue: 'invalid' });
    expect(evaluateGoal(78, Number.NaN, 85)).toEqual({ ok: false, issue: 'invalid' });
    expect(evaluateGoal(78, 80, Number.POSITIVE_INFINITY)).toEqual({ ok: false, issue: 'invalid' });
    expect(goalIssueMessage('missing_start')).toMatch(/valor inicial/);
  });

  it('supports a zero initial value (e.g. workouts per week)', () => {
    const e = evaluateGoal(0, 3, 4);
    expect(e.ok && e.ratio).toBe(0.75);
  });
});

describe('goal projections', () => {
  it('projects completion only when moving toward target', () => {
    expect(projectGoalDate(1, 0.5, '2026-11-25')).toBe('2026-12-09');
    expect(projectGoalDate(1, -0.5, '2026-11-25')).toBeNull();
    expect(projectGoalDate(1, null, '2026-11-25')).toBeNull();
    expect(projectGoalDate(0, 0.5, '2026-11-25')).toBe('2026-11-25');
  });

  it('computes required weekly rate', () => {
    expect(requiredWeeklyRate({ targetValue: 85, targetDate: '2026-12-23' }, 83, '2026-11-25')).toBe(0.5);
    expect(requiredWeeklyRate({ targetValue: 85 }, 83, '2026-11-25')).toBeNull();
    expect(requiredWeeklyRate({ targetValue: 85, targetDate: '2026-11-01' }, 83, '2026-11-25')).toBeNull();
  });
});
