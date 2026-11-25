/**
 * Domain models for Iron Track.
 *
 * Conventions
 * - IDs are UUID strings (sync-friendly).
 * - Every record has createdAt/updatedAt ISO timestamps.
 * - `day` fields are local DayKeys (YYYY-MM-DD).
 * - Masses in kg / g, lengths in cm, volumes in ml. Display may convert.
 * - Historical records store snapshots (names, nutrients) so editing a
 *   template or a catalog food never rewrites the past.
 */
import type { DayKey } from '@/lib/dates';

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface BaseRecord extends Timestamps {
  id: string;
}

// ---- Profile & settings ----------------------------------------------------

export type Sex = 'male' | 'female';
export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high';

export interface Profile extends Timestamps {
  id: 'me';
  name: string;
  birthDate?: DayKey;
  sex?: Sex;
  heightCm?: number;
  trainingExperience?: TrainingExperience;
  activityLevel?: ActivityLevel;
  notes?: string;
  onboardedAt: string;
}

export interface AppSettings extends Timestamps {
  id: 'app';
  /** 0 = Sunday, 1 = Monday */
  weekStartsOn: 0 | 1;
  /** Hour (0–5) at which a new day begins for logging purposes. */
  dayStartHour: number;
  defaultRestSec: number;
  /** True once the starter exercise catalog was installed (never reinstalled after removal). */
  catalogSeeded?: boolean;
  /** Notification permission was requested for the rest timer. */
  restAlertsAsked?: boolean;
}

// ---- Nutrition -------------------------------------------------------------

export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}

/**
 * Daily targets are versioned: a target applies from `effectiveFrom` until a
 * newer one exists. Changing targets today never alters past days' progress.
 */
export interface NutritionTarget extends BaseRecord, Nutrients {
  effectiveFrom: DayKey;
  waterMl: number;
}

export interface FoodServing {
  id: string;
  label: string; // e.g. "1 scoop", "1 ovo"
  grams: number;
}

/** Food catalog item. Nutrients are per 100 g (or 100 ml for liquids). */
export interface Food extends BaseRecord {
  name: string;
  brand?: string;
  per100g: Nutrients;
  servings: FoodServing[];
  favorite: boolean;
  isSeed: boolean;
  archivedAt?: string;
}

export type MealSlot = 'breakfast' | 'lunch' | 'afternoon' | 'pre_workout' | 'post_workout' | 'dinner' | 'supper';

export interface MealTemplateItem {
  foodId: string;
  grams: number;
}

/** A saved meal ("Café da manhã padrão") for one-tap re-logging. */
export interface MealTemplate extends BaseRecord {
  name: string;
  slot?: MealSlot;
  items: MealTemplateItem[];
  archivedAt?: string;
}

/** A logged food. Nutrients are a snapshot computed at log time. */
export interface FoodEntry extends BaseRecord {
  day: DayKey;
  slot: MealSlot;
  foodId?: string;
  foodName: string;
  grams: number;
  servingLabel?: string;
  nutrients: Nutrients;
  mealTemplateId?: string;
  loggedAt: string;
}

export interface WaterEntry extends BaseRecord {
  day: DayKey;
  amountMl: number;
  loggedAt: string;
}

// ---- Body ------------------------------------------------------------------

export interface BodyWeightEntry extends BaseRecord {
  day: DayKey;
  measuredAt: string;
  weightKg: number;
  note?: string;
}

/** Predefined body sites. Limbs are always recorded per side. */
export type MeasurementSite =
  | 'custom'
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'waist'
  | 'abdomen'
  | 'hips'
  | 'arm_left'
  | 'arm_right'
  | 'forearm_left'
  | 'forearm_right'
  | 'thigh_left'
  | 'thigh_right'
  | 'calf_left'
  | 'calf_right';

export interface MeasurementEntry extends BaseRecord {
  day: DayKey;
  measuredAt: string;
  site: MeasurementSite;
  /** Required when site is 'custom' (e.g. "Ombro relaxado"). */
  customName?: string;
  valueCm: number;
}

export interface BodyCompositionEntry extends BaseRecord {
  day: DayKey;
  measuredAt: string;
  bodyFatPct?: number;
  muscleMassKg?: number;
  method?: 'bioimpedance' | 'skinfold' | 'dexa' | 'estimate';
  note?: string;
}

// ---- Goals -----------------------------------------------------------------

export type GoalKind =
  | 'body_weight'
  | 'body_fat'
  | 'muscle_mass'
  | 'measurement'
  | 'performance'
  | 'conditioning'
  | 'consistency';
export type GoalStatus = 'active' | 'paused' | 'completed';

export interface Goal extends BaseRecord {
  kind: GoalKind;
  title: string;
  unit: string;
  /** Initial value. May be missing (progress is then not computed). */
  startValue?: number;
  targetValue: number;
  /**
   * Manually maintained current value. Only used for kinds without a
   * record source (performance, conditioning). Other kinds derive the
   * current value from their records.
   */
  manualCurrentValue?: number;
  /** Creation day of the goal. */
  startDate: DayKey;
  targetDate?: DayKey;
  isPrimary: boolean;
  status: GoalStatus;
  completedAt?: string;
  notes?: string;
  /** Measurement goals: site key, plus customName for custom sites. */
  ref?: MeasurementSite;
  refName?: string;
}

// ---- Training --------------------------------------------------------------

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'full_body'
  | 'cardio';

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'smith' | 'other';
export type MovementType = 'compound' | 'isolation' | 'cardio';

export interface Exercise extends BaseRecord {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  movementType: MovementType;
  instructions?: string;
  /** Optional local image (data URL, resized on import). */
  imageDataUrl?: string;
  defaultSets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  notes?: string;
  /** Exercise ids suggested as substitutes. */
  alternativeIds: string[];
  isSeed: boolean;
  archivedAt?: string;
}

/**
 * A routine. Active routines form a rotation (A → B → C → A…) ordered by
 * sortOrder; the next one is suggested after each completed session.
 */
export interface WorkoutTemplate extends BaseRecord {
  name: string;
  description?: string;
  notes?: string;
  sortOrder: number;
  active: boolean;
  archivedAt?: string;
}

export interface TemplateExercise extends BaseRecord {
  templateId: string;
  exerciseId: string;
  sortOrder: number;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  notes?: string;
}

export type SessionStatus = 'in_progress' | 'completed' | 'discarded';

/** Rest timer state, timestamp-based so it survives backgrounding and restarts. */
export interface RestTimerState {
  durationSec: number;
  /** ISO time the rest ends while running. */
  endsAt?: string;
  /** Remaining ms while paused. */
  pausedRemainingMs?: number;
}

/** A performed workout. Template fields are copied, never referenced live. */
export interface WorkoutSession extends BaseRecord {
  templateId?: string;
  name: string;
  day: DayKey;
  startedAt: string;
  endedAt?: string;
  status: SessionStatus;
  notes?: string;
  /** Set while the session is paused. */
  pausedAt?: string;
  /** Accumulated paused time, excluded from duration. */
  pausedMs?: number;
  rest?: RestTimerState;
}

export interface SessionExercise extends BaseRecord {
  sessionId: string;
  exerciseId: string;
  /** Snapshot of the name at the time of the session. */
  exerciseName: string;
  primaryMuscle?: MuscleGroup;
  sortOrder: number;
  targetSets?: number;
  repMin?: number;
  repMax?: number;
  restSec: number;
  notes?: string;
  skipped?: boolean;
  /** Set when this exercise replaced the planned one during the session. */
  substitutedFromId?: string;
  substitutedFromName?: string;
}

export type SetKind = 'warmup' | 'working' | 'drop' | 'failure';

export interface SetRecord extends BaseRecord {
  sessionId: string;
  sessionExerciseId: string;
  sortOrder: number;
  kind: SetKind;
  weightKg: number;
  reps: number;
  /** Reps in reserve, optional. */
  rir?: number;
  note?: string;
  completedAt?: string;
}
