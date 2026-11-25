import { describe, expect, it } from 'vitest';
import { sumWater, waterProgress } from './water';

describe('water', () => {
  it('sums and computes progress', () => {
    const entries = [{ amountMl: 500 }, { amountMl: 750 }, { amountMl: 250 }];
    expect(sumWater(entries)).toBe(1500);
    const p = waterProgress(entries, 4000);
    expect(p.ratio).toBeCloseTo(0.375);
    expect(p.remaining).toBe(2500);
    expect(sumWater([])).toBe(0);
  });
});
