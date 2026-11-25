import Dexie, { type EntityTable } from 'dexie';
import type {
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
  }
}

export const db = new IronTrackDB();

/** Table names in a stable order (used by backup/export). */
export const TABLE_NAMES = [
  'profile',
  'settings',
  'nutritionTargets',
  'foods',
  'mealTemplates',
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
