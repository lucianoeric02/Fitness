import { describe, expect, it } from 'vitest';
import { adjustRest, formatClock, pauseRest, resetRest, restPhase, restRemainingMs, resumeRest, startRest } from './restTimer';

const T0 = Date.parse('2026-11-25T18:00:00Z');

describe('rest timer (timestamp-based)', () => {
  it('derives remaining time from the end timestamp, not from ticks', () => {
    const s = startRest(90, T0);
    expect(restRemainingMs(s, T0)).toBe(90_000);
    expect(restRemainingMs(s, T0 + 30_000)).toBe(60_000);
    expect(restPhase(s, T0 + 30_000)).toBe('running');
  });

  it('stays correct after backgrounding: no ticks for 2 minutes', () => {
    const s = startRest(90, T0);
    // App was in the background; the next render happens 120 s later.
    expect(restRemainingMs(s, T0 + 120_000)).toBe(0);
    expect(restPhase(s, T0 + 120_000)).toBe('done');
  });

  it('pauses, resumes and keeps the remaining time', () => {
    const paused = pauseRest(startRest(90, T0), T0 + 20_000);
    expect(restPhase(paused, T0 + 500_000)).toBe('paused');
    expect(restRemainingMs(paused, T0 + 500_000)).toBe(70_000);
    const resumed = resumeRest(paused, T0 + 500_000);
    expect(restRemainingMs(resumed, T0 + 510_000)).toBe(60_000);
  });

  it('resets to the full duration and adjusts ±seconds without going negative', () => {
    const s = startRest(90, T0);
    expect(restRemainingMs(resetRest(s, T0 + 80_000), T0 + 80_000)).toBe(90_000);
    expect(restRemainingMs(adjustRest(s, 15, T0), T0)).toBe(105_000);
    expect(restRemainingMs(adjustRest(s, -200, T0), T0)).toBe(0);
    const p = adjustRest(pauseRest(s, T0 + 10_000), -15, T0 + 10_000);
    expect(restRemainingMs(p, T0 + 99_999)).toBe(65_000);
  });

  it('formats a countdown clock', () => {
    expect(formatClock(90_000)).toBe('1:30');
    expect(formatClock(5_200)).toBe('0:06');
    expect(formatClock(0)).toBe('0:00');
    expect(restPhase(undefined, T0)).toBe('idle');
  });
});
