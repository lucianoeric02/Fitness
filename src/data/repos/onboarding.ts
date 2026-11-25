import { db } from '@/data/db';
import { nowIso, type DayKey } from '@/lib/dates';
import { addBodyWeight, savePrimaryWeightGoal } from './body';
import { DEFAULT_SETTINGS, saveProfile, type ProfileInput } from './profile';
import { setTargetsFrom, type TargetValues } from './targets';

export interface OnboardingInput {
  profile: ProfileInput;
  currentWeightKg: number;
  targetWeightKg: number;
  targetDate?: DayKey;
  targets: TargetValues;
  today: DayKey;
}

/** Writes the whole first-run setup atomically: all or nothing. */
export async function completeOnboarding(input: OnboardingInput): Promise<void> {
  await db.transaction('rw', [db.profile, db.settings, db.nutritionTargets, db.bodyWeights, db.goals], async () => {
    const now = nowIso();
    if (!(await db.settings.get('app'))) {
      await db.settings.put({ ...DEFAULT_SETTINGS, createdAt: now, updatedAt: now });
    }
    await saveProfile(input.profile);
    await setTargetsFrom(input.today, input.targets);
    await addBodyWeight({ day: input.today, weightKg: input.currentWeightKg });
    await savePrimaryWeightGoal({
      startValue: input.currentWeightKg,
      targetValue: input.targetWeightKg,
      startDate: input.today,
      targetDate: input.targetDate,
    });
  });
}
