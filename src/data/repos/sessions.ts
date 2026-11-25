import { db } from '@/data/db';
import { adjustRest, pauseRest, resetRest, resumeRest, startRest } from '@/domain/calc/restTimer';
import type { Exercise, SessionExercise, SetRecord, WorkoutSession } from '@/domain/models';
import { nowIso, type DayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { templateItems } from './templates';

export class ActiveSessionExistsError extends Error {
  constructor(public readonly sessionId: string) {
    super('Já existe um treino em andamento.');
  }
}

export async function getActiveSession(): Promise<WorkoutSession | null> {
  return (await db.workoutSessions.where('status').equals('in_progress').first()) ?? null;
}

/** Completed sets of the most recent completed session that included the exercise. */
export async function lastPerformance(exerciseId: string, excludeSessionId?: string): Promise<{ session: WorkoutSession; sets: SetRecord[] } | null> {
  const items = await db.sessionExercises.where('exerciseId').equals(exerciseId).toArray();
  const sessions = (await db.workoutSessions.bulkGet([...new Set(items.map((i) => i.sessionId))]))
    .filter((s): s is WorkoutSession => Boolean(s) && s!.status === 'completed' && s!.id !== excludeSessionId)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  for (const session of sessions) {
    const own = items.filter((i) => i.sessionId === session.id).map((i) => i.id);
    const sets = (await db.sets.where('sessionId').equals(session.id).toArray())
      .filter((s) => own.includes(s.sessionExerciseId) && s.completedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (sets.length) return { session, sets };
  }
  return null;
}

/** Planned sets for an exercise, pre-filled from the last time it was done. */
async function plannedSets(sessionId: string, se: SessionExercise, count: number): Promise<SetRecord[]> {
  const last = await lastPerformance(se.exerciseId, sessionId);
  const now = nowIso();
  return Array.from({ length: Math.max(1, count) }, (_, i) => {
    const prev = last?.sets[Math.min(i, (last?.sets.length ?? 1) - 1)];
    return {
      id: newId(),
      sessionId,
      sessionExerciseId: se.id,
      sortOrder: i,
      kind: 'working',
      weightKg: prev?.weightKg ?? 0,
      reps: prev?.reps ?? se.repMax ?? 0,
      createdAt: now,
      updatedAt: now,
    } satisfies SetRecord;
  });
}

function snapshot(sessionId: string, ex: Exercise, sortOrder: number, p: { targetSets: number; repMin: number; repMax: number; restSec: number; notes?: string }): SessionExercise {
  const now = nowIso();
  return {
    id: newId(),
    sessionId,
    exerciseId: ex.id,
    exerciseName: ex.name,
    primaryMuscle: ex.primaryMuscle,
    sortOrder,
    targetSets: p.targetSets,
    repMin: p.repMin,
    repMax: p.repMax,
    restSec: p.restSec,
    notes: p.notes,
    createdAt: now,
    updatedAt: now,
  };
}

const ALL = () => [db.workoutSessions, db.sessionExercises, db.sets, db.exercises, db.templateExercises, db.workoutTemplates];

/**
 * Starts a session. Only called from an explicit "Iniciar treino" tap.
 * The routine is copied into the session; later routine edits don't touch it.
 */
export async function startSession(input: { templateId?: string; day: DayKey; name?: string }): Promise<WorkoutSession> {
  return db.transaction('rw', ALL(), async () => {
    const active = await getActiveSession();
    if (active) throw new ActiveSessionExistsError(active.id);
    const template = input.templateId ? await db.workoutTemplates.get(input.templateId) : undefined;
    const now = nowIso();
    const session: WorkoutSession = {
      id: newId(),
      templateId: template?.id,
      name: template?.name ?? input.name ?? 'Treino livre',
      day: input.day,
      startedAt: now,
      status: 'in_progress',
      pausedMs: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.workoutSessions.add(session);
    if (template) {
      const items = await templateItems(template.id);
      for (const [idx, item] of items.entries()) {
        const ex = await db.exercises.get(item.exerciseId);
        if (!ex) continue;
        const se = snapshot(session.id, ex, idx, item);
        await db.sessionExercises.add(se);
        await db.sets.bulkAdd(await plannedSets(session.id, se, item.targetSets));
      }
    }
    return session;
  });
}

async function touch(sessionId: string) {
  await db.workoutSessions.update(sessionId, { updatedAt: nowIso() });
}

export async function sessionExercises(sessionId: string): Promise<SessionExercise[]> {
  return db.sessionExercises.where('[sessionId+sortOrder]').between([sessionId, -Infinity], [sessionId, Infinity]).toArray();
}

// ---- Sets ---------------------------------------------------------------------

/** Completes a set and starts the rest timer for its exercise. */
export async function completeSet(setId: string, values: { weightKg: number; reps: number }, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.sets, db.sessionExercises, db.workoutSessions], async () => {
    const set = await db.sets.get(setId);
    if (!set) throw new Error('Série não encontrada.');
    const se = await db.sessionExercises.get(set.sessionExerciseId);
    const iso = new Date(now).toISOString();
    await db.sets.update(setId, { weightKg: values.weightKg, reps: values.reps, completedAt: iso, updatedAt: iso });
    const rest = se && se.restSec > 0 ? startRest(se.restSec, now) : undefined;
    await db.workoutSessions.update(set.sessionId, { rest, updatedAt: iso });
  });
}

/** Undo: the set goes back to planned, values kept. */
export async function uncompleteSet(setId: string): Promise<void> {
  await db.sets.update(setId, { completedAt: undefined, updatedAt: nowIso() });
}

export async function updateSet(setId: string, patch: Partial<Pick<SetRecord, 'weightKg' | 'reps' | 'rir' | 'note' | 'kind'>>): Promise<void> {
  const clean = { ...patch, updatedAt: nowIso() };
  if (patch.note !== undefined) clean.note = patch.note.trim() || undefined;
  await db.sets.update(setId, clean);
}

/** Adds a set copying the previous set's weight and reps. */
export async function addSet(sessionExerciseId: string): Promise<SetRecord> {
  return db.transaction('rw', [db.sets, db.sessionExercises, db.workoutSessions], async () => {
    const se = await db.sessionExercises.get(sessionExerciseId);
    if (!se) throw new Error('Exercício não encontrado.');
    const own = (await db.sets.where('sessionExerciseId').equals(sessionExerciseId).toArray()).sort((a, b) => a.sortOrder - b.sortOrder);
    const prev = own[own.length - 1];
    const now = nowIso();
    const set: SetRecord = {
      id: newId(),
      sessionId: se.sessionId,
      sessionExerciseId,
      sortOrder: (prev?.sortOrder ?? -1) + 1,
      kind: 'working',
      weightKg: prev?.weightKg ?? 0,
      reps: prev?.reps ?? se.repMax ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.sets.add(set);
    if (se.skipped) await db.sessionExercises.update(se.id, { skipped: false });
    await touch(se.sessionId);
    return set;
  });
}

export async function deleteSet(setId: string): Promise<void> {
  await db.sets.delete(setId);
}

// ---- Exercises in a session ------------------------------------------------------

export async function setExerciseSkipped(sessionExerciseId: string, skipped: boolean): Promise<void> {
  await db.sessionExercises.update(sessionExerciseId, { skipped, updatedAt: nowIso() });
}

export async function setExerciseNotes(sessionExerciseId: string, notes: string): Promise<void> {
  await db.sessionExercises.update(sessionExerciseId, { notes: notes.trim() || undefined, updatedAt: nowIso() });
}

/** Adds an exercise at the end of the session with its default prescription. */
export async function addSessionExercise(sessionId: string, exerciseId: string): Promise<SessionExercise> {
  return db.transaction('rw', ALL(), async () => {
    const ex = await db.exercises.get(exerciseId);
    if (!ex) throw new Error('Exercício não encontrado.');
    const count = await db.sessionExercises.where('sessionId').equals(sessionId).count();
    const se = snapshot(sessionId, ex, count, { targetSets: ex.defaultSets, repMin: ex.repMin, repMax: ex.repMax, restSec: ex.restSec });
    await db.sessionExercises.add(se);
    await db.sets.bulkAdd(await plannedSets(sessionId, se, ex.defaultSets));
    await touch(sessionId);
    return se;
  });
}

/**
 * Replaces an exercise for this session only. Completed sets stay with the
 * original exercise (it is kept, marked as replaced); remaining planned sets
 * move to the substitute. The routine is untouched unless the caller then
 * explicitly calls swapTemplateExercise.
 */
export async function substituteExercise(sessionExerciseId: string, newExerciseId: string): Promise<SessionExercise> {
  return db.transaction('rw', ALL(), async () => {
    const original = await db.sessionExercises.get(sessionExerciseId);
    const ex = await db.exercises.get(newExerciseId);
    if (!original || !ex) throw new Error('Exercício não encontrado.');
    const sets = await db.sets.where('sessionExerciseId').equals(original.id).toArray();
    const done = sets.filter((s) => s.completedAt);
    const pending = sets.filter((s) => !s.completedAt);
    const now = nowIso();

    const replacement: SessionExercise = {
      ...snapshot(original.sessionId, ex, original.sortOrder, {
        targetSets: original.targetSets ?? ex.defaultSets,
        repMin: original.repMin ?? ex.repMin,
        repMax: original.repMax ?? ex.repMax,
        restSec: original.restSec,
      }),
      substitutedFromId: original.exerciseId,
      substitutedFromName: original.exerciseName,
    };

    // Shift later exercises to make room right after the original.
    const all = await sessionExercises(original.sessionId);
    if (done.length) {
      for (const e of all) if (e.sortOrder > original.sortOrder) await db.sessionExercises.update(e.id, { sortOrder: e.sortOrder + 1 });
      replacement.sortOrder = original.sortOrder + 1;
      await db.sessionExercises.update(original.id, { skipped: true, updatedAt: now });
    } else {
      await db.sessionExercises.delete(original.id);
    }
    await db.sessionExercises.add(replacement);
    await db.sets.bulkDelete(pending.map((s) => s.id));
    await db.sets.bulkAdd(await plannedSets(original.sessionId, replacement, Math.max(1, pending.length)));
    await touch(original.sessionId);
    return replacement;
  });
}

// ---- Rest timer -------------------------------------------------------------------

type RestAction = 'pause' | 'resume' | 'reset' | 'skip' | { adjust: number } | { start: number };

export async function restControl(sessionId: string, action: RestAction, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.workoutSessions, async () => {
    const s = await db.workoutSessions.get(sessionId);
    if (!s) return;
    let rest = s.rest;
    if (action === 'skip') rest = undefined;
    else if (typeof action === 'object' && 'start' in action) rest = startRest(action.start, now);
    else if (!rest) return;
    else if (action === 'pause') rest = pauseRest(rest, now);
    else if (action === 'resume') rest = resumeRest(rest, now);
    else if (action === 'reset') rest = resetRest(rest, now);
    else if (typeof action === 'object' && 'adjust' in action) rest = adjustRest(rest, action.adjust, now);
    await db.workoutSessions.update(sessionId, { rest, updatedAt: new Date(now).toISOString() });
  });
}

// ---- Session lifecycle ----------------------------------------------------------------

export async function pauseSession(sessionId: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.workoutSessions, async () => {
    const s = await db.workoutSessions.get(sessionId);
    if (!s || s.pausedAt) return;
    const iso = new Date(now).toISOString();
    await db.workoutSessions.update(sessionId, { pausedAt: iso, rest: s.rest ? pauseRest(s.rest, now) : undefined, updatedAt: iso });
  });
}

export async function resumeSession(sessionId: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.workoutSessions, async () => {
    const s = await db.workoutSessions.get(sessionId);
    if (!s?.pausedAt) return;
    const pausedMs = (s.pausedMs ?? 0) + (now - new Date(s.pausedAt).getTime());
    await db.workoutSessions.update(sessionId, {
      pausedAt: undefined,
      pausedMs,
      rest: s.rest ? resumeRest(s.rest, now) : undefined,
      updatedAt: new Date(now).toISOString(),
    });
  });
}

/**
 * Finishes and persists the session. Planned sets that were never completed
 * are removed so history shows only what was performed; exercises without any
 * completed set are kept and marked as skipped.
 */
export async function finishSession(sessionId: string, notes?: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.workoutSessions, db.sessionExercises, db.sets], async () => {
    const s = await db.workoutSessions.get(sessionId);
    if (!s || s.status !== 'in_progress') return;
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    await db.sets.bulkDelete(sets.filter((x) => !x.completedAt).map((x) => x.id));
    const done = new Set(sets.filter((x) => x.completedAt).map((x) => x.sessionExerciseId));
    for (const e of await sessionExercises(sessionId)) if (!done.has(e.id) && !e.skipped) await db.sessionExercises.update(e.id, { skipped: true });
    const pausedMs = (s.pausedMs ?? 0) + (s.pausedAt ? now - new Date(s.pausedAt).getTime() : 0);
    const iso = new Date(now).toISOString();
    await db.workoutSessions.update(sessionId, {
      status: 'completed',
      endedAt: iso,
      pausedAt: undefined,
      pausedMs,
      rest: undefined,
      notes: notes?.trim() || s.notes,
      updatedAt: iso,
    });
  });
}

export async function updateSessionNotes(sessionId: string, notes: string): Promise<void> {
  await db.workoutSessions.update(sessionId, { notes: notes.trim() || undefined, updatedAt: nowIso() });
}

/** Cancels (deletes) an in-progress session and everything recorded in it. */
export async function cancelSession(sessionId: string): Promise<void> {
  await db.transaction('rw', [db.workoutSessions, db.sessionExercises, db.sets], async () => {
    await db.sets.where('sessionId').equals(sessionId).delete();
    await db.sessionExercises.where('sessionId').equals(sessionId).delete();
    await db.workoutSessions.delete(sessionId);
  });
}

/** Deletes a completed session from history. */
export const deleteSession = cancelSession;
