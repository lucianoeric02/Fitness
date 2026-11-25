import { beforeEach, describe, expect, it } from 'vitest';
import { wipeAllData } from './backup';
import { db, DB_NAME, IronTrackDB } from './db';
import { ensureExerciseCatalog, removeExercise, removeSeedExercises } from './repos/exercises';
import {
  ActiveSessionExistsError,
  addSessionExercise,
  addSet,
  cancelSession,
  completeSet,
  finishSession,
  getActiveSession,
  lastPerformance,
  pauseSession,
  restControl,
  resumeSession,
  sessionExercises,
  substituteExercise,
  uncompleteSet,
} from './repos/sessions';
import {
  addTemplateExercise,
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  moveTemplate,
  moveTemplateExercise,
  swapTemplateExercise,
  templateItems,
  updateTemplate,
  updateTemplateExercise,
} from './repos/templates';
import { catalogId, EXERCISE_CATALOG } from '@/domain/exerciseCatalog';
import { restPhase, restRemainingMs } from '@/domain/calc/restTimer';

const DAY = '2026-11-25';
const BENCH = catalogId('bench_bb');
const INCLINE = catalogId('incline_db');
const DB_BENCH = catalogId('bench_db');

/** Sets in display order: by exercise position, then set number. */
async function setsOf(sessionId: string) {
  const order = new Map((await sessionExercises(sessionId)).map((e) => [e.id, e.sortOrder]));
  return (await db.sets.where('sessionId').equals(sessionId).toArray()).sort(
    (a, b) => (order.get(a.sessionExerciseId) ?? 0) - (order.get(b.sessionExerciseId) ?? 0) || a.sortOrder - b.sortOrder,
  );
}

async function pushDay() {
  const t = await createTemplate({ name: 'Push' });
  await addTemplateExercise(t.id, BENCH);
  await addTemplateExercise(t.id, INCLINE);
  return t;
}

beforeEach(async () => {
  await wipeAllData();
  await ensureExerciseCatalog();
});

describe('exercise catalog', () => {
  it('installs once with resolvable alternatives, and never reinstalls after removal', async () => {
    expect(await db.exercises.count()).toBe(EXERCISE_CATALOG.length);
    const bench = await db.exercises.get(BENCH);
    expect(bench?.alternativeIds.every((id) => EXERCISE_CATALOG.some((c) => catalogId(c.key) === id))).toBe(true);
    expect(await ensureExerciseCatalog()).toBe(0);
    await removeSeedExercises();
    await ensureExerciseCatalog();
    expect(await db.exercises.filter((e) => !e.archivedAt).count()).toBe(0);
  });

  it('archives instead of deleting exercises used in routines', async () => {
    const t = await createTemplate({ name: 'A' });
    await addTemplateExercise(t.id, BENCH);
    expect(await removeExercise(BENCH)).toBe('archived');
    expect(await removeExercise(INCLINE)).toBe('deleted');
  });
});

describe('templates', () => {
  it('creates, edits, orders, duplicates and deletes', async () => {
    const t = await pushDay();
    await updateTemplate(t.id, { name: '  Push A ', description: 'Peito e tríceps' });
    expect((await db.workoutTemplates.get(t.id))?.name).toBe('Push A');

    let items = await templateItems(t.id);
    expect(items.map((i) => i.exerciseId)).toEqual([BENCH, INCLINE]);
    expect(items[0]).toMatchObject({ targetSets: 4, repMin: 6, repMax: 10, restSec: 150 }); // catalog defaults
    await moveTemplateExercise(items[1]!.id, -1);
    items = await templateItems(t.id);
    expect(items.map((i) => i.exerciseId)).toEqual([INCLINE, BENCH]);

    const copy = await duplicateTemplate(t.id);
    expect((await templateItems(copy.id)).map((i) => i.exerciseId)).toEqual([INCLINE, BENCH]);
    expect(copy.sortOrder).toBeGreaterThan(t.sortOrder);
    await moveTemplate(copy.id, -1);
    expect((await db.workoutTemplates.get(copy.id))!.sortOrder).toBeLessThan((await db.workoutTemplates.get(t.id))!.sortOrder);

    await deleteTemplate(t.id);
    expect(await db.templateExercises.where('templateId').equals(t.id).count()).toBe(0);
  });
});

describe('sessions', () => {
  it('only one active session; template is snapshotted', async () => {
    const t = await pushDay();
    const s = await startSession_(t.id);
    await expect(startSession_(t.id)).rejects.toBeInstanceOf(ActiveSessionExistsError);
    const items = await sessionExercises(s.id);
    expect(items.map((i) => i.exerciseName)).toEqual(['Supino reto com barra', 'Supino inclinado com halteres']);
    expect(await setsOf(s.id)).toHaveLength(4 + 3);
    // Editing the routine afterwards does not touch the running session.
    await updateTemplateExercise((await templateItems(t.id))[0]!.id, { targetSets: 2 });
    expect(await setsOf(s.id)).toHaveLength(7);
  });

  it('records sets, starts rest, undoes, adds sets copying the previous one', async () => {
    const t = await pushDay();
    const s = await startSession_(t.id);
    const [first] = await setsOf(s.id);
    const now = Date.parse('2026-11-25T18:00:00Z');
    await completeSet(first!.id, { weightKg: 100, reps: 8 }, now);
    const after = await db.workoutSessions.get(s.id);
    expect(restPhase(after!.rest, now + 1000)).toBe('running');
    expect(restRemainingMs(after!.rest, now)).toBe(150_000);
    await restControl(s.id, 'pause', now + 30_000);
    await restControl(s.id, 'resume', now + 90_000);
    expect(restRemainingMs((await db.workoutSessions.get(s.id))!.rest, now + 90_000)).toBe(120_000);
    await restControl(s.id, 'skip');
    expect((await db.workoutSessions.get(s.id))!.rest).toBeUndefined();

    await uncompleteSet(first!.id);
    expect((await db.sets.get(first!.id))?.completedAt).toBeUndefined();
    await completeSet(first!.id, { weightKg: 100, reps: 8 });
    const item = (await sessionExercises(s.id))[0]!;
    const extra = await addSet(item.id);
    expect(extra).toMatchObject({ weightKg: 0, sortOrder: 4 }); // copies previous planned set (no history yet)
  });

  it('pre-fills the next session from the last performance', async () => {
    const t = await pushDay();
    const s1 = await startSession_(t.id);
    const sets = await setsOf(s1.id);
    await completeSet(sets[0]!.id, { weightKg: 100, reps: 8 });
    await completeSet(sets[1]!.id, { weightKg: 100, reps: 7 });
    await finishSession(s1.id, 'Bom treino');
    const last = await lastPerformance(BENCH);
    expect(last?.sets.map((x) => [x.weightKg, x.reps])).toEqual([
      [100, 8],
      [100, 7],
    ]);
    const s2 = await startSession_(t.id);
    const benchItem = (await sessionExercises(s2.id))[0]!;
    const planned = (await setsOf(s2.id)).filter((x) => x.sessionExerciseId === benchItem.id);
    expect(planned.map((x) => [x.weightKg, x.reps])).toEqual([
      [100, 8],
      [100, 7],
      [100, 7],
      [100, 7],
    ]);
    expect(planned.every((x) => !x.completedAt)).toBe(true); // nothing auto-completed or auto-increased
  });

  it('substitutes for this session only unless the routine is explicitly updated', async () => {
    const t = await pushDay();
    const s = await startSession_(t.id);
    const bench = (await sessionExercises(s.id))[0]!;
    const sets = await setsOf(s.id);
    await completeSet(sets[0]!.id, { weightKg: 100, reps: 8 });
    const repl = await substituteExercise(bench.id, DB_BENCH);
    const items = await sessionExercises(s.id);
    expect(items.map((i) => [i.exerciseName, Boolean(i.skipped)])).toEqual([
      ['Supino reto com barra', true],
      ['Supino reto com halteres', false],
      ['Supino inclinado com halteres', false],
    ]);
    expect(repl.substitutedFromName).toBe('Supino reto com barra');
    expect((await db.sets.where('sessionExerciseId').equals(bench.id).toArray()).length).toBe(1); // completed set kept
    expect((await templateItems(t.id))[0]!.exerciseId).toBe(BENCH);
    await swapTemplateExercise(t.id, BENCH, DB_BENCH);
    expect((await templateItems(t.id))[0]!.exerciseId).toBe(DB_BENCH);
  });

  it('pauses, resumes and finishes, keeping only performed sets', async () => {
    const t = await pushDay();
    const s = await startSession_(t.id);
    const t0 = Date.parse(s.startedAt);
    await pauseSession(s.id, t0 + 10 * 60_000);
    await resumeSession(s.id, t0 + 15 * 60_000);
    const sets = await setsOf(s.id);
    await completeSet(sets[0]!.id, { weightKg: 80, reps: 10 });
    await addSessionExercise(s.id, catalogId('pushdown_rope'));
    await finishSession(s.id, '', t0 + 60 * 60_000);
    const done = await db.workoutSessions.get(s.id);
    expect(done).toMatchObject({ status: 'completed', pausedMs: 5 * 60_000 });
    expect(await setsOf(s.id)).toHaveLength(1);
    const items = await sessionExercises(s.id);
    expect(items.filter((i) => i.skipped).map((i) => i.exerciseName)).toEqual(['Supino inclinado com halteres', 'Tríceps pulley com corda']);
    expect(await getActiveSession()).toBeNull();
  });

  it('cancels a session completely', async () => {
    const t = await pushDay();
    const s = await startSession_(t.id);
    await cancelSession(s.id);
    expect(await db.workoutSessions.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
    expect(await db.sessionExercises.count()).toBe(0);
  });

  it('keeps completed history when the routine and exercise change later', async () => {
    const t = await pushDay();
    const s = await startSession_(t.id);
    await completeSet((await setsOf(s.id))[0]!.id, { weightKg: 100, reps: 8 });
    await finishSession(s.id);
    await db.exercises.update(BENCH, { name: 'Supino (renomeado)' });
    await deleteTemplate(t.id);
    expect((await sessionExercises(s.id))[0]!.exerciseName).toBe('Supino reto com barra');
    expect((await db.workoutSessions.get(s.id))?.name).toBe('Push');
  });

  it('survives an app restart: a new DB connection sees the active session and rest timer', async () => {
    const t = await pushDay();
    const s = await startSession_(t.id);
    const now = Date.now();
    await completeSet((await setsOf(s.id))[0]!.id, { weightKg: 100, reps: 8 }, now);
    db.close();
    const reopened = new IronTrackDB(DB_NAME);
    await reopened.open();
    const active = await reopened.workoutSessions.where('status').equals('in_progress').first();
    expect(active?.id).toBe(s.id);
    expect(restPhase(active!.rest, now + 1000)).toBe('running');
    expect((await reopened.sets.where('sessionId').equals(s.id).toArray()).filter((x) => x.completedAt)).toHaveLength(1);
    reopened.close();
    await db.open();
  });
});

async function startSession_(templateId: string) {
  const { startSession } = await import('./repos/sessions');
  return startSession({ templateId, day: DAY });
}
