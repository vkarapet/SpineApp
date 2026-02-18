import { getProfile, saveProfile, deleteProfile, addAuditEntry, clearAllData } from '../core/db';
import { generateUUID } from '../utils/uuid';
import { CONSENT_VERSION, APP_VERSION } from '../constants';
import type { UserProfile, UserPreferences } from '../types/db-schemas';

export interface ProfileInput {
  participantId: string;
  name?: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  audio_enabled: true,
  haptic_enabled: true,
  dominant_hand: 'right',
  reminder_frequency: 'off',
};

export async function createProfile(input: ProfileInput): Promise<UserProfile> {
  const deviceId = generateUUID();
  const now = new Date().toISOString();

  const profile: UserProfile = {
    id: 'current',
    participant_id: input.participantId.trim(),
    name: input.name?.trim() ?? '',
    consent_date: now,
    consent_version: CONSENT_VERSION,
    device_id: deviceId,
    preferences: { ...DEFAULT_PREFERENCES },
    restoration_pending: false,
    schema_version: 1,
    created_at: now,
    updated_at: now,
  };

  await saveProfile(profile);

  await addAuditEntry({
    action: 'profile_created',
    entity_id: input.participantId.trim(),
    details: { device_id: deviceId, app_version: APP_VERSION },
  });

  await addAuditEntry({
    action: 'consent_given',
    entity_id: input.participantId.trim(),
    details: { consent_version: CONSENT_VERSION },
  });

  return profile;
}

export async function loadProfile(): Promise<UserProfile | undefined> {
  return getProfile();
}

export async function updateProfile(
  participantId?: string,
  name?: string,
): Promise<UserProfile | undefined> {
  const profile = await getProfile();
  if (!profile) return undefined;

  const updatedFields: string[] = [];

  if (participantId !== undefined) {
    profile.participant_id = participantId.trim();
    updatedFields.push('participant_id');
  }
  if (name !== undefined) {
    profile.name = name.trim();
    updatedFields.push('name');
  }

  profile.updated_at = new Date().toISOString();

  await saveProfile(profile);

  await addAuditEntry({
    action: 'profile_updated',
    entity_id: profile.participant_id,
    details: { fields: updatedFields },
  });

  return profile;
}

export async function updatePreferences(
  prefs: Partial<UserPreferences>,
): Promise<UserProfile | undefined> {
  const profile = await getProfile();
  if (!profile) return undefined;

  profile.preferences = { ...profile.preferences, ...prefs };
  profile.updated_at = new Date().toISOString();

  await saveProfile(profile);
  return profile;
}

export async function isConsentCurrent(): Promise<boolean> {
  const profile = await getProfile();
  if (!profile) return false;
  return profile.consent_version === CONSENT_VERSION;
}

export async function signOut(): Promise<void> {
  const profile = await getProfile();
  if (profile) {
    await addAuditEntry({
      action: 'account_signed_out',
      entity_id: profile.participant_id,
      details: {},
    });
  }
  await clearAllData();
}

export { deleteProfile };
