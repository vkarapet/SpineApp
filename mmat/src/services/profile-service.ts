import { getProfile, saveProfile, deleteProfile, addAuditEntry, clearAllData } from '../core/db';
import { generateSubjectHash } from '../utils/crypto';
import { generateUUID } from '../utils/uuid';
import { STUDY_SALT, CONSENT_VERSION, APP_VERSION } from '../constants';
import type { UserProfile, UserPreferences } from '../types/db-schemas';

export interface ProfileInput {
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  audio_enabled: true,
  haptic_enabled: true,
  dominant_hand: 'right',
  reminder_frequency: 'off',
};

export async function createProfile(input: ProfileInput): Promise<UserProfile> {
  const subjectHash = await generateSubjectHash(input.email, input.dob, STUDY_SALT);
  const deviceId = generateUUID();
  const now = new Date().toISOString();

  const profile: UserProfile = {
    id: 'current',
    subject_hash: subjectHash,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    dob: input.dob,
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
    entity_id: subjectHash,
    details: { device_id: deviceId, app_version: APP_VERSION },
  });

  await addAuditEntry({
    action: 'consent_given',
    entity_id: subjectHash,
    details: { consent_version: CONSENT_VERSION },
  });

  return profile;
}

export async function loadProfile(): Promise<UserProfile | undefined> {
  return getProfile();
}

export async function updateProfileName(
  firstName: string,
  lastName: string,
): Promise<UserProfile | undefined> {
  const profile = await getProfile();
  if (!profile) return undefined;

  profile.first_name = firstName.trim();
  profile.last_name = lastName.trim();
  profile.updated_at = new Date().toISOString();

  await saveProfile(profile);

  await addAuditEntry({
    action: 'profile_updated',
    entity_id: profile.subject_hash,
    details: { fields: ['first_name', 'last_name'] },
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
      entity_id: profile.subject_hash,
      details: {},
    });
  }
  await clearAllData();
}

export { deleteProfile };
