import Dexie, { type EntityTable } from 'dexie';
import type {
  MealDefinition,
  AppSettings,
  BodyCompositionEntry,
  BodyWeightEntry,
  Exercise,
  Food,
  FoodEntry,
  Goal,
  MealTemplate,
  MeasurementEntry,
  NutritionTarget,
  Profile,
  SessionExercise,
  SetRecord,
  TemplateExercise,
  WaterEntry,
  WorkoutSession,
  WorkoutTemplate,
} from '@/domain/models';

export const DB_NAME = 'iron-track';

/**
 * Local IndexedDB database. This is the source of truth; any cloud sync is
 * layered on top and optional.
 *
 * Schema changes: never edit an existing version() block once shipped —
 * add a new version with the change (and an upgrade() when data moves).
 */
export class IronTrackDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  nutritionTargets!: EntityTable<NutritionTarget, 'id'>;
  foods!: EntityTable<Food, 'id'>;
  mealTemplates!: EntityTable<MealTemplate, 'id'>;
  meals!: EntityTable<MealDefinition, 'id'>;
  foodEntries!: EntityTable<FoodEntry, 'id'>;
  waterEntries!: EntityTable<WaterEntry, 'id'>;
  bodyWeights!: EntityTable<BodyWeightEntry, 'id'>;
  measurements!: EntityTable<MeasurementEntry, 'id'>;
  bodyComposition!: EntityTable<BodyCompositionEntry, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  workoutTemplates!: EntityTable<WorkoutTemplate, 'id'>;
  templateExercises!: EntityTable<TemplateExercise, 'id'>;
  workoutSessions!: EntityTable<WorkoutSession, 'id'>;
  sessionExercises!: EntityTable<SessionExercise, 'id'>;
  sets!: EntityTable<SetRecord, 'id'>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      nutritionTargets: 'id, effectiveFrom',
      foods: 'id, name, updatedAt',
      mealTemplates: 'id, name',
      foodEntries: 'id, day, [day+slot], foodId, loggedAt',
      waterEntries: 'id, day, loggedAt',
      bodyWeights: 'id, day, measuredAt',
      measurements: 'id, day, site, [site+day]',
      bodyComposition: 'id, day',
      goals: 'id, kind, status',
      exercises: 'id, name, primaryMuscle',
      workoutTemplates: 'id, sortOrder',
      templateExercises: 'id, templateId, exerciseId, [templateId+sortOrder]',
      workoutSessions: 'id, day, status, templateId, startedAt',
      sessionExercises: 'id, sessionId, exerciseId, [sessionId+sortOrder]',
      sets: 'id, sessionId, sessionExerciseId',
    });

    // v2: goal statuses/kinds revised (achieved → completed, archived → paused,
    // lift → performance, custom → conditioning); measurements gain custom sites.
    this.version(2)
      .stores({ measurements: 'id, day, site, [site+day], measuredAt' })
      .upgrade((tx) =>
        tx
          .table('goals')
          .toCollection()
          .modify((g) => {
            Object.assign(g, migrateGoalV1(g));
          }),
      );

    // v3: workout system. Routines gain an active flag (rotation); exercises
    // gain prescription defaults; sets index by completion for history.
    this.version(3)
      .stores({
        workoutSessions: 'id, day, status, templateId, startedAt, endedAt',
        sets: 'id, sessionId, sessionExerciseId, completedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('workoutTemplates')
          .toCollection()
          .modify((t) => {
            if (t.active === undefined) t.active = !t.archivedAt;
          });
        await tx
          .table('exercises')
          .toCollection()
          .modify((e) => {
            e.movementType ??= 'compound';
            e.defaultSets ??= 3;
            e.repMin ??= 8;
            e.repMax ??= 12;
            e.restSec ??= 90;
            e.alternativeIds ??= [];
            e.secondaryMuscles ??= [];
          });
      });

    // v4: nutrition system. Customisable meals table; foods gain category/unit;
    // template items keep a food-name snapshot.
    this.version(4)
      .stores({ meals: 'id, sortOrder', foods: 'id, name, category, updatedAt' })
      .upgrade(async (tx) => {
        await tx
          .table('foods')
          .toCollection()
          .modify((f) => {
            f.category ??= 'other';
            f.unit ??= 'g';
            f.servings ??= [];
            f.favorite ??= false;
          });
        await tx
          .table('mealTemplates')
          .toCollection()
          .modify((t) => {
            t.items = (t.items ?? []).map((i: { foodName?: string }) => ({ ...i, foodName: i.foodName ?? 'Alimento' }));
          });
      });
  }
}

/** Maps a v1 goal record to the v2 shape. Used by the DB upgrade and backup import. */
export function migrateGoalV1(g: Record<string, unknown>): Record<string, unknown> {
  const statusMap: Record<string, string> = { achieved: 'completed', archived: 'paused' };
  const kindMap: Record<string, string> = { lift: 'performance', custom: 'conditioning' };
  return {
    ...g,
    status: statusMap[g.status as string] ?? g.status,
    kind: kindMap[g.kind as string] ?? g.kind,
  };
}

export const db = new IronTrackDB();

/** Table names in a stable order (used by backup/export). */
export const TABLE_NAMES = [
  'profile',
  'settings',
  'nutritionTargets',
  'foods',
  'mealTemplates',
  'meals',
  'foodEntries',
  'waterEntries',
  'bodyWeights',
  'measurements',
  'bodyComposition',
  'goals',
  'exercises',
  'workoutTemplates',
  'templateExercises',
  'workoutSessions',
  'sessionExercises',
  'sets',
] as const satisfies ReadonlyArray<keyof IronTrackDB>;

export type TableName = (typeof TABLE_NAMES)[number];

/** Ask the browser not to evict our data under storage pressure (web/PWA). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // Not supported: ignore.
  }
  return false;
}
