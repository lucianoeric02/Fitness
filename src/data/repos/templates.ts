import { db } from '@/data/db';
import type { TemplateExercise, WorkoutTemplate } from '@/domain/models';
import { nowIso } from '@/lib/dates';
import { newId } from '@/lib/ids';

/**
 * Routines (templates) and their exercises. Sessions copy what they need at
 * start time, so nothing here rewrites completed history.
 */

export async function listTemplates(): Promise<WorkoutTemplate[]> {
  return (await db.workoutTemplates.orderBy('sortOrder').toArray()).filter((t) => !t.archivedAt);
}

export async function templateItems(templateId: string): Promise<TemplateExercise[]> {
  return db.templateExercises.where('[templateId+sortOrder]').between([templateId, -Infinity], [templateId, Infinity]).toArray();
}

async function nextSortOrder(): Promise<number> {
  const last = await db.workoutTemplates.orderBy('sortOrder').last();
  return (last?.sortOrder ?? -1) + 1;
}

export async function createTemplate(input: { name: string; description?: string; notes?: string }): Promise<WorkoutTemplate> {
  const now = nowIso();
  const t: WorkoutTemplate = {
    id: newId(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    sortOrder: await nextSortOrder(),
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await db.workoutTemplates.add(t);
  return t;
}

export async function updateTemplate(id: string, patch: Partial<Pick<WorkoutTemplate, 'name' | 'description' | 'notes' | 'active'>>): Promise<void> {
  const clean: Partial<WorkoutTemplate> = { ...patch, updatedAt: nowIso() };
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.description !== undefined) clean.description = patch.description.trim() || undefined;
  if (patch.notes !== undefined) clean.notes = patch.notes.trim() || undefined;
  await db.workoutTemplates.update(id, clean);
}

export async function duplicateTemplate(id: string): Promise<WorkoutTemplate> {
  return db.transaction('rw', [db.workoutTemplates, db.templateExercises], async () => {
    const src = await db.workoutTemplates.get(id);
    if (!src) throw new Error('Rotina não encontrada.');
    const now = nowIso();
    const copy: WorkoutTemplate = { ...src, id: newId(), name: `${src.name} (cópia)`.slice(0, 40), sortOrder: await nextSortOrder(), createdAt: now, updatedAt: now };
    await db.workoutTemplates.add(copy);
    const items = await templateItems(id);
    await db.templateExercises.bulkAdd(items.map((i) => ({ ...i, id: newId(), templateId: copy.id, createdAt: now, updatedAt: now })));
    return copy;
  });
}

/** Deletes a routine and its exercise list. Past sessions keep their own copies. */
export async function deleteTemplate(id: string): Promise<void> {
  await db.transaction('rw', [db.workoutTemplates, db.templateExercises], async () => {
    await db.templateExercises.where('templateId').equals(id).delete();
    await db.workoutTemplates.delete(id);
  });
}

/** Moves a routine up/down among routines with the same active status (the rotation order). */
export async function moveTemplate(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.workoutTemplates, async () => {
    const all = await listTemplates();
    const self = all.find((t) => t.id === id);
    if (!self) return;
    const peers = all.filter((t) => t.active === self.active);
    const i = peers.findIndex((t) => t.id === id);
    const other = peers[i + direction];
    if (!other) return;
    const now = nowIso();
    await db.workoutTemplates.update(self.id, { sortOrder: other.sortOrder, updatedAt: now });
    await db.workoutTemplates.update(other.id, { sortOrder: self.sortOrder, updatedAt: now });
  });
}

// ---- Template exercises ---------------------------------------------------------

async function renumber(templateId: string, ordered: TemplateExercise[]) {
  const now = nowIso();
  await Promise.all(ordered.map((it, idx) => (it.sortOrder === idx ? null : db.templateExercises.update(it.id, { sortOrder: idx, updatedAt: now }))));
  await db.workoutTemplates.update(templateId, { updatedAt: now });
}

/** Adds an exercise using the exercise's default prescription. */
export async function addTemplateExercise(templateId: string, exerciseId: string): Promise<TemplateExercise> {
  return db.transaction('rw', [db.templateExercises, db.exercises, db.workoutTemplates], async () => {
    const ex = await db.exercises.get(exerciseId);
    if (!ex) throw new Error('Exercício não encontrado.');
    const items = await templateItems(templateId);
    const now = nowIso();
    const item: TemplateExercise = {
      id: newId(),
      templateId,
      exerciseId,
      sortOrder: items.length,
      targetSets: ex.defaultSets,
      repMin: ex.repMin,
      repMax: ex.repMax,
      restSec: ex.restSec,
      createdAt: now,
      updatedAt: now,
    };
    await db.templateExercises.add(item);
    await db.workoutTemplates.update(templateId, { updatedAt: now });
    return item;
  });
}

export async function updateTemplateExercise(id: string, patch: Partial<Pick<TemplateExercise, 'targetSets' | 'repMin' | 'repMax' | 'restSec' | 'notes'>>): Promise<void> {
  await db.templateExercises.update(id, { ...patch, notes: patch.notes === undefined ? undefined : patch.notes.trim() || undefined, updatedAt: nowIso() });
}

export async function removeTemplateExercise(id: string): Promise<void> {
  await db.transaction('rw', [db.templateExercises, db.workoutTemplates], async () => {
    const item = await db.templateExercises.get(id);
    if (!item) return;
    await db.templateExercises.delete(id);
    await renumber(item.templateId, await templateItems(item.templateId));
  });
}

export async function moveTemplateExercise(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', [db.templateExercises, db.workoutTemplates], async () => {
    const item = await db.templateExercises.get(id);
    if (!item) return;
    const items = await templateItems(item.templateId);
    const i = items.findIndex((x) => x.id === id);
    const j = i + direction;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j]!, items[i]!];
    await renumber(item.templateId, items);
  });
}

/** Explicit "also update the routine" after a substitution in a session. */
export async function swapTemplateExercise(templateId: string, fromExerciseId: string, toExerciseId: string): Promise<boolean> {
  const item = (await templateItems(templateId)).find((i) => i.exerciseId === fromExerciseId);
  if (!item) return false;
  await db.templateExercises.update(item.id, { exerciseId: toExerciseId, updatedAt: nowIso() });
  return true;
}
