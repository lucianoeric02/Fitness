import { db } from '@/data/db';
import type { AppSettings, Profile } from '@/domain/models';
import { nowIso } from '@/lib/dates';

export const DEFAULT_SETTINGS: Omit<AppSettings, 'createdAt' | 'updatedAt'> = {
  id: 'app',
  weekStartsOn: 1,
  dayStartHour: 0,
  defaultRestSec: 90,
};

export async function getProfile(): Promise<Profile | null> {
  return (await db.profile.get('me')) ?? null;
}

export type ProfileInput = Pick<Profile, 'name' | 'birthDate' | 'sex' | 'heightCm'>;

export async function saveProfile(input: ProfileInput): Promise<Profile> {
  return db.transaction('rw', db.profile, async () => {
    const existing = await db.profile.get('me');
    const now = nowIso();
    const profile: Profile = {
      id: 'me',
      name: input.name.trim(),
      birthDate: input.birthDate || undefined,
      sex: input.sex,
      heightCm: input.heightCm,
      onboardedAt: existing?.onboardedAt ?? now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.profile.put(profile);
    return profile;
  });
}

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.get('app');
  if (s) return s;
  const now = nowIso();
  return { ...DEFAULT_SETTINGS, createdAt: now, updatedAt: now };
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AppSettings> {
  return db.transaction('rw', db.settings, async () => {
    const current = await getSettings();
    const next: AppSettings = { ...current, ...patch, id: 'app', updatedAt: nowIso() };
    await db.settings.put(next);
    return next;
  });
}
