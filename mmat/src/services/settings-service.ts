import { getProfile, saveProfile } from '../core/db';
import type { UserPreferences } from '../types/db-schemas';

export async function getPreferences(): Promise<UserPreferences | null> {
  const profile = await getProfile();
  return profile?.preferences ?? null;
}

export async function updatePreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): Promise<void> {
  const profile = await getProfile();
  if (!profile) return;

  profile.preferences[key] = value;
  profile.updated_at = new Date().toISOString();
  await saveProfile(profile);
}

export async function getLastSyncedAt(): Promise<string | null> {
  const profile = await getProfile();
  return profile?.last_synced_at ?? null;
}

export async function setLastSyncedAt(timestamp: string): Promise<void> {
  const profile = await getProfile();
  if (!profile) return;

  profile.last_synced_at = timestamp;
  profile.updated_at = new Date().toISOString();
  await saveProfile(profile);
}
