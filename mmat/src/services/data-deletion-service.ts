import { getProfile, clearAllData, addAuditEntry, addToSyncQueue } from '../core/db';

export async function deleteAllData(): Promise<{ success: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { success: false, error: 'No profile found' };

  try {
    if (navigator.onLine) {
      // Send delete request to proxy
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_data',
          record_id: profile.participant_id,
        }),
      });

      if (!response.ok) {
        return { success: false, error: 'Server could not process deletion request' };
      }
    } else {
      // Queue deletion for when online
      await addToSyncQueue({
        type: 'delete_data',
        payload: {
          record_id: profile.participant_id,
        },
        local_uuid: null,
        status: 'pending',
        attempts: 0,
        max_attempts: 5,
        created_at: new Date().toISOString(),
        last_attempt_at: null,
        next_retry_at: null,
        error: null,
      });
    }

    await addAuditEntry({
      action: 'data_deleted',
      entity_id: profile.participant_id,
      details: { online: navigator.onLine },
    });

    await clearAllData();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
