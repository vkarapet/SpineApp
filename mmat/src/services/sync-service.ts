import {
  getProfile,
  saveProfile,
  getUnsyncedResults,
  saveResult,
  addToSyncQueue,
  getPendingSyncItems,
  updateSyncItem,
  clearCompletedSyncItems,
  addAuditEntry,
  pruneOldSyncedResults,
} from '../core/db';
import { apiCall } from './api-client';
import { setLastSyncedAt } from './settings-service';
import {
  SYNC_BACKOFF_BASE_MS,
  SYNC_BACKOFF_MULTIPLIER,
  SYNC_BACKOFF_CAP_MS,
  SYNC_MAX_ATTEMPTS,
  CLOCK_DRIFT_THRESHOLD_MS,
  BATCH_THRESHOLD,
  ANALYTICS_URL,
} from '../constants';
import { eventBus } from '../main';
import type { AssessmentResult } from '../types/db-schemas';

let syncing = false;

export async function triggerSync(): Promise<void> {
  if (syncing || !navigator.onLine) return;
  syncing = true;

  try {
    eventBus.emit('sync-status', 'syncing');

    // 1. Upload unsynced results
    const unsyncedResults = await getUnsyncedResults();

    if (unsyncedResults.length > BATCH_THRESHOLD) {
      await batchUpload(unsyncedResults);
    } else {
      for (const result of unsyncedResults) {
        await uploadResult(result);
      }
    }

    // 2. Process sync queue
    await processSyncQueue();

    // 3. Clean up completed items
    await clearCompletedSyncItems();

    // 4. Prune old synced results
    await pruneOldSyncedResults();

    // 5. Update last synced timestamp
    await setLastSyncedAt(new Date().toISOString());

    // 6. Send analytics
    await sendAnalytics();

    eventBus.emit('sync-status', 'idle');
  } catch (err) {
    console.error('Sync error:', err);
    eventBus.emit('sync-status', 'error');
  } finally {
    syncing = false;
  }
}

async function uploadResult(result: AssessmentResult): Promise<void> {
  const profile = await getProfile();
  if (!profile) return;

  try {
    const response = await apiCall({
      action: 'upload_data',
      record_id: profile.participant_id,
      device_id: profile.device_id,
      payload: {
        local_uuid: result.local_uuid,
        task_type: result.task_type,
        timestamp_start: result.timestamp_start,
        session_metadata: result.session_metadata,
        raw_data: JSON.stringify(result.raw_data),
        computed_metrics: result.computed_metrics,
        flagged: result.flagged,
        flag_reason: result.flag_reason,
        checksum: result.checksum,
        device_id: profile.device_id,
      },
    });

    if (response.success) {
      result.synced = true;
      result.sync_attempts++;
      await saveResult(result);

      await addAuditEntry({
        action: 'sync_success',
        entity_id: result.local_uuid,
        details: { task_type: result.task_type },
      });

      // Check clock drift
      if (response.serverTimestamp) {
        checkClockDrift(response.serverTimestamp);
      }
    } else {
      result.sync_attempts++;
      await saveResult(result);

      // Add to sync queue for retry
      await addToSyncQueue({
        type: 'upload_data',
        payload: { local_uuid: result.local_uuid },
        local_uuid: result.local_uuid,
        status: 'pending',
        attempts: 1,
        max_attempts: SYNC_MAX_ATTEMPTS,
        created_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        next_retry_at: new Date(Date.now() + SYNC_BACKOFF_BASE_MS).toISOString(),
        error: response.error ?? null,
      });
    }
  } catch (err) {
    await addAuditEntry({
      action: 'sync_failed',
      entity_id: result.local_uuid,
      details: { error: String(err) },
    });
  }
}

async function batchUpload(results: AssessmentResult[]): Promise<void> {
  const profile = await getProfile();
  if (!profile) return;

  // Split into batches
  const batchSize = 10;
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);

    const payloads = batch.map((result) => ({
      local_uuid: result.local_uuid,
      task_type: result.task_type,
      timestamp_start: result.timestamp_start,
      session_metadata: result.session_metadata,
      raw_data: JSON.stringify(result.raw_data),
      computed_metrics: result.computed_metrics,
      flagged: result.flagged,
      flag_reason: result.flag_reason,
      checksum: result.checksum,
      device_id: profile.device_id,
    }));

    try {
      const response = await apiCall({
        action: 'upload_data',
        record_id: profile.participant_id,
        device_id: profile.device_id,
        payload: { records: payloads },
      });

      if (response.success) {
        for (const result of batch) {
          result.synced = true;
          result.sync_attempts++;
          await saveResult(result);
        }

        if (response.serverTimestamp) {
          checkClockDrift(response.serverTimestamp);
        }
      }
    } catch (err) {
      console.error('Batch upload error:', err);
    }

    // 1s delay between batches
    if (i + batchSize < results.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function processSyncQueue(): Promise<void> {
  const profile = await getProfile();
  if (!profile) return;

  const pending = await getPendingSyncItems();

  for (const item of pending) {
    const now = Date.now();
    if (item.next_retry_at && new Date(item.next_retry_at).getTime() > now) {
      continue; // Not time to retry yet
    }

    if (item.attempts >= item.max_attempts) {
      item.status = 'failed';
      await updateSyncItem(item);
      continue;
    }

    item.status = 'in_flight';
    item.last_attempt_at = new Date().toISOString();
    await updateSyncItem(item);

    try {
      const response = await apiCall({
        action: item.type,
        record_id: profile.participant_id,
        device_id: profile.device_id,
        payload: item.payload,
      });

      if (response.success) {
        item.status = 'completed';
        await updateSyncItem(item);
      } else {
        item.attempts++;
        item.status = 'pending';
        item.error = response.error ?? null;
        const backoff = Math.min(
          SYNC_BACKOFF_BASE_MS * Math.pow(SYNC_BACKOFF_MULTIPLIER, item.attempts - 1),
          SYNC_BACKOFF_CAP_MS,
        );
        item.next_retry_at = new Date(Date.now() + backoff).toISOString();
        await updateSyncItem(item);
      }
    } catch (err) {
      item.attempts++;
      item.status = 'pending';
      item.error = String(err);
      const backoff = Math.min(
        SYNC_BACKOFF_BASE_MS * Math.pow(SYNC_BACKOFF_MULTIPLIER, item.attempts - 1),
        SYNC_BACKOFF_CAP_MS,
      );
      item.next_retry_at = new Date(Date.now() + backoff).toISOString();
      await updateSyncItem(item);
    }
  }
}

async function checkClockDrift(serverTimestamp: number): Promise<void> {
  const localTimestamp = Date.now();
  const drift = Math.abs(localTimestamp - serverTimestamp);

  if (drift > CLOCK_DRIFT_THRESHOLD_MS) {
    const profile = await getProfile();
    if (profile) {
      profile.clock_offset = localTimestamp - serverTimestamp;
      await saveProfile(profile);
    }
    eventBus.emit('clock-drift-warning', drift);
  }
}

async function sendAnalytics(): Promise<void> {
  try {
    const unsyncedResults = await getUnsyncedResults();
    await fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessment_count: unsyncedResults.length,
        sync_success: true,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Analytics failures are non-critical
  }
}
