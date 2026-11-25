import { db } from '@/data/db';
import { getSettings, updateSettings } from '@/data/repos/profile';
import { catalogId, EXERCISE_CATALOG } from '@/domain/exerciseCatalog';
import type { Exercise } from '@/domain/models';
import { nowIso } from '@/lib/dates';
import { newId } from '@/lib/ids';

/** Installs the starter catalog once. Never reinstalls after the user removes it. */
export async function ensureExerciseCatalog(): Promise<number> {
  const settings = await getSettings();
  if (settings.catalogSeeded) return 0;
  const now = nowIso();
  const rows: Exercise[] = EXERCISE_CATALOG.map((c) => ({
    id: catalogId(c.key),
    name: c.name,
    primaryMuscle: c.primary,
    secondaryMuscles: c.secondary,
    equipment: c.equipment,
    movementType: c.movement,
    instructions: c.instructions,
    defaultSets: c.sets,
    repMin: c.repMin,
    repMax: c.repMax,
    restSec: c.restSec,
    alternativeIds: c.alternatives.map(catalogId),
    isSeed: true,
    createdAt: now,
    updatedAt: now,
  }));
  await db.transaction('rw', [db.exercises, db.settings], async () => {
    const existing = new Set((await db.exercises.toArray()).map((e) => e.id));
    await db.exercises.bulkAdd(rows.filter((r) => !existing.has(r.id)));
    await updateSettings({ catalogSeeded: true });
  });
  return rows.length;
}

export async function listExercises(includeArchived = false): Promise<Exercise[]> {
  const all = await db.exercises.orderBy('name').toArray();
  return includeArchived ? all : all.filter((e) => !e.archivedAt);
}

export type ExerciseInput = Pick<
  Exercise,
  'name' | 'primaryMuscle' | 'secondaryMuscles' | 'equipment' | 'movementType' | 'instructions' | 'imageDataUrl' | 'defaultSets' | 'repMin' | 'repMax' | 'restSec' | 'notes' | 'alternativeIds'
>;

function clean(input: ExerciseInput): ExerciseInput {
  return {
    ...input,
    name: input.name.trim(),
    instructions: input.instructions?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    secondaryMuscles: input.secondaryMuscles.filter((m) => m !== input.primaryMuscle),
  };
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const now = nowIso();
  const ex: Exercise = { id: newId(), ...clean(input), isSeed: false, createdAt: now, updatedAt: now };
  await db.exercises.add(ex);
  return ex;
}

/** Editing an exercise never rewrites history: sessions keep their name snapshot. */
export async function updateExercise(id: string, input: ExerciseInput): Promise<void> {
  const current = await db.exercises.get(id);
  if (!current) throw new Error('Exercício não encontrado.');
  await db.exercises.put({ ...current, ...clean(input), updatedAt: nowIso() });
}

async function isReferenced(id: string): Promise<boolean> {
  const [inTemplates, inSessions] = await Promise.all([db.templateExercises.where('exerciseId').equals(id).count(), db.sessionExercises.where('exerciseId').equals(id).count()]);
  return inTemplates + inSessions > 0;
}

/**
 * Removes an exercise. If routines or history reference it, it is archived
 * instead (hidden from the library, history intact). Returns what happened.
 */
export async function removeExercise(id: string): Promise<'deleted' | 'archived'> {
  return db.transaction('rw', [db.exercises, db.templateExercises, db.sessionExercises], async () => {
    if (await isReferenced(id)) {
      await db.exercises.update(id, { archivedAt: nowIso(), updatedAt: nowIso() });
      return 'archived';
    }
    await db.exercises.delete(id);
    return 'deleted';
  });
}

/** Removes the starter catalog: unused entries are deleted, used ones archived. */
export async function removeSeedExercises(): Promise<{ deleted: number; archived: number }> {
  const seeds = (await db.exercises.toArray()).filter((e) => e.isSeed && !e.archivedAt);
  let deleted = 0;
  let archived = 0;
  for (const e of seeds) {
    if ((await removeExercise(e.id)) === 'deleted') deleted += 1;
    else archived += 1;
  }
  return { deleted, archived };
}
