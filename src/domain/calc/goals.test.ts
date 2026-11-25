import { describe, expect, it } from 'vitest';
import { goalProgress, projectGoalDate, requiredWeeklyRate } from './goals';

describe('goals', () => {
  it('handles gain goals', () => {
    const g = { startValue: 78, targetValue: 85 };
    expect(goalProgress(g, 81.5).ratio).toBeCloseTo(0.5);
    expect(goalProgress(g, 81.5).remaining).toBe(3.5);
    expect(goalProgress(g, 77).ratio).toBe(0);
    expect(goalProgress(g, 86).achieved).toBe(true);
    expect(goalProgress(g, 86).ratio).toBe(1);
  });

  it('handles loss goals', () => {
    const g = { startValue: 90, targetValue: 84 };
    const p = goalProgress(g, 87);
    expect(p.direction).toBe('decrease');
    expect(p.ratio).toBeCloseTo(0.5);
    expect(p.remaining).toBe(-3);
    expect(goalProgress(g, 84).achieved).toBe(true);
  });

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
