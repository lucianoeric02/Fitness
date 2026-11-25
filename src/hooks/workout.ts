import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { getActiveSession, sessionExercises } from '@/data/repos/sessions';
import { listTemplates, templateItems } from '@/data/repos/templates';
import { estimateDurationMin, nextInRotation } from '@/domain/calc/workout';
import type { Exercise, MuscleGroup, TemplateExercise, WorkoutTemplate } from '@/domain/models';

export function useActiveSession() {
  return useLiveQuery(() => getActiveSession(), []);
}

export interface TemplateSummary {
  template: WorkoutTemplate;
  items: TemplateExercise[];
  muscles: MuscleGroup[];
  estimatedMin: number;
}

async function summarize(template: WorkoutTemplate, exercises: Map<string, Exercise>): Promise<TemplateSummary> {
  const items = await templateItems(template.id);
  const muscles = [...new Set(items.flatMap((i) => (exercises.get(i.exerciseId) ? [exercises.get(i.exerciseId)!.primaryMuscle] : [])))];
  return { template, items, muscles, estimatedMin: estimateDurationMin(items) };
}

/** Routines with derived muscles/duration and the next one in the rotation. */
export function useRoutines() {
  return useLiveQuery(async () => {
    const [templates, exercises, lastDone] = await Promise.all([
      listTemplates(),
      db.exercises.toArray(),
      db.workoutSessions.where('status').equals('completed').sortBy('startedAt'),
    ]);
    const exMap = new Map(exercises.map((e) => [e.id, e]));
    const summaries = await Promise.all(templates.map((t) => summarize(t, exMap)));
    const lastWithTemplate = [...lastDone].reverse().find((s) => s.templateId);
    const next = nextInRotation(templates, lastWithTemplate?.templateId);
    return { summaries, next: next ? summaries.find((s) => s.template.id === next.id)! : null, lastSession: lastDone[lastDone.length - 1] ?? null };
  }, []);
}

/** Everything the active-workout / summary screens need. */
export function useSessionDetail(sessionId: string | undefined) {
  return useLiveQuery(async () => {
    if (!sessionId) return null;
    const session = await db.workoutSessions.get(sessionId);
    if (!session) return null;
    const [items, sets] = await Promise.all([sessionExercises(sessionId), db.sets.where('sessionId').equals(sessionId).toArray()]);
    const exercises = await db.exercises.bulkGet(items.map((i) => i.exerciseId));
    return {
      session,
      items,
      sets: sets.sort((a, b) => a.sortOrder - b.sortOrder),
      exercises: new Map(exercises.filter((e): e is Exercise => Boolean(e)).map((e) => [e.id, e])),
    };
  }, [sessionId]);
}

export interface ExerciseHistoryEntry {
  session: import('@/domain/models').WorkoutSession;
  sets: import('@/domain/models').SetRecord[];
  substitutedFromName?: string;
}

/** Completed sessions containing the exercise, newest first, with their completed sets. */
export function useExerciseHistory(exerciseId: string | undefined) {
  return useLiveQuery(async () => {
    if (!exerciseId) return [];
    const items = await db.sessionExercises.where('exerciseId').equals(exerciseId).toArray();
    const sessions = await db.workoutSessions.bulkGet([...new Set(items.map((i) => i.sessionId))]);
    const out: ExerciseHistoryEntry[] = [];
    for (const session of sessions) {
      if (!session || session.status !== 'completed') continue;
      const own = items.filter((i) => i.sessionId === session.id);
      const ids = new Set(own.map((i) => i.id));
      const sets = (await db.sets.where('sessionId').equals(session.id).toArray()).filter((s) => ids.has(s.sessionExerciseId) && s.completedAt).sort((a, b) => a.sortOrder - b.sortOrder);
      if (sets.length) out.push({ session, sets, substitutedFromName: own.find((o) => o.substitutedFromName)?.substitutedFromName });
    }
    return out.sort((a, b) => (a.session.startedAt < b.session.startedAt ? 1 : -1));
  }, [exerciseId]);
}

export function useExerciseLibrary() {
  return useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
}
