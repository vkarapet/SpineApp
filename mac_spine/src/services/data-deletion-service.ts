import { getProfile, clearAssessmentData, addAuditEntry } from '../core/db';

export async function deleteAllData(): Promise<{ success: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { success: false, error: 'No profile found' };

  try {
    await addAuditEntry({
      action: 'data_deleted',
      entity_id: profile.participant_id,
      details: {},
    });

    await clearAssessmentData();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
