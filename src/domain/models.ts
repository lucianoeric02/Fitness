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

export interface Profile extends Timestamps {
  id: 'me';
  name: string;
  birthDate?: DayKey;
  sex?: Sex;
  heightCm?: number;
  onboardedAt: string;
}

export interface AppSettings extends Timestamps {
  id: 'app';
  /** 0 = Sunday, 1 = Monday */
  weekStartsOn: 0 | 1;
  /** Hour (0–5) at which a new day begins for logging purposes. */
  dayStartHour: number;
  defaultRestSec: number;
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

export type MeasurementSite =
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

export type GoalKind = 'body_weight' | 'measurement' | 'body_fat' | 'lift' | 'custom';
export type GoalStatus = 'active' | 'achieved' | 'archived';

export interface Goal extends BaseRecord {
  kind: GoalKind;
  title: string;
  unit: string;
  startValue: number;
  targetValue: number;
  startDate: DayKey;
  targetDate?: DayKey;
  isPrimary: boolean;
  status: GoalStatus;
  /** Measurement site or exercise id, depending on kind. */
  ref?: string;
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

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'other';

export interface Exercise extends BaseRecord {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  notes?: string;
  isSeed: boolean;
  archivedAt?: string;
}

export interface WorkoutTemplate extends BaseRecord {
  name: string;
  notes?: string;
  sortOrder: number;
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

/** A performed workout. Template fields are copied, never referenced live. */
export interface WorkoutSession extends BaseRecord {
  templateId?: string;
  name: string;
  day: DayKey;
  startedAt: string;
  endedAt?: string;
  status: SessionStatus;
  notes?: string;
}

export interface SessionExercise extends BaseRecord {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  sortOrder: number;
  restSec: number;
  notes?: string;
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
  completedAt?: string;
}
