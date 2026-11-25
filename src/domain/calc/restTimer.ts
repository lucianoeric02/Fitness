import type { RestTimerState } from '@/domain/models';

/**
 * Rest timer as pure state transitions. Remaining time is always derived
 * from timestamps (endsAt − now), never from counting ticks, so it stays
 * correct after the app is backgrounded, the screen sleeps or the app
 * restarts.
 */
export type RestPhase = 'idle' | 'running' | 'paused' | 'done';

export function startRest(durationSec: number, now: number): RestTimerState {
  return { durationSec, endsAt: new Date(now + durationSec * 1000).toISOString() };
}

export function restRemainingMs(state: RestTimerState | undefined, now: number): number {
  if (!state) return 0;
  if (state.pausedRemainingMs !== undefined) return Math.max(0, state.pausedRemainingMs);
  if (!state.endsAt) return 0;
  return Math.max(0, new Date(state.endsAt).getTime() - now);
}

export function restPhase(state: RestTimerState | undefined, now: number): RestPhase {
  if (!state) return 'idle';
  if (state.pausedRemainingMs !== undefined) return 'paused';
  if (!state.endsAt) return 'idle';
  return restRemainingMs(state, now) > 0 ? 'running' : 'done';
}

export function pauseRest(state: RestTimerState, now: number): RestTimerState {
  if (restPhase(state, now) !== 'running') return state;
  return { durationSec: state.durationSec, pausedRemainingMs: restRemainingMs(state, now) };
}

export function resumeRest(state: RestTimerState, now: number): RestTimerState {
  if (state.pausedRemainingMs === undefined) return state;
  return { durationSec: state.durationSec, endsAt: new Date(now + state.pausedRemainingMs).toISOString() };
}

/** Back to the full duration, running. */
export function resetRest(state: RestTimerState, now: number): RestTimerState {
  return startRest(state.durationSec, now);
}

/** Adds (or removes, when negative) time; never below zero. */
export function adjustRest(state: RestTimerState, deltaSec: number, now: number): RestTimerState {
  const remaining = Math.max(0, restRemainingMs(state, now) + deltaSec * 1000);
  const durationSec = Math.max(0, state.durationSec + deltaSec);
  if (state.pausedRemainingMs !== undefined) return { durationSec, pausedRemainingMs: remaining };
  return { durationSec, endsAt: new Date(now + remaining).toISOString() };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
