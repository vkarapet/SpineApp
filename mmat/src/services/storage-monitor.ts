import { requestPersistentStorage, getStorageEstimate, isPersisted } from '../utils/storage';
import { getProfile } from '../core/db';
import { STORAGE_WARNING_THRESHOLD } from '../constants';
import { eventBus } from '../main';

export async function initStorageMonitor(): Promise<void> {
  // Request persistent storage on first launch
  const persisted = await isPersisted();
  if (!persisted) {
    const granted = await requestPersistentStorage();
    if (!granted) {
      eventBus.emit('storage-not-persisted');
    }
  }

  // Check storage usage
  await checkStorageUsage();
}

export async function checkStorageUsage(): Promise<void> {
  const estimate = await getStorageEstimate();

  if (estimate.percent >= STORAGE_WARNING_THRESHOLD) {
    eventBus.emit('storage-warning', {
      usage: estimate.usage,
      quota: estimate.quota,
      percent: estimate.percent,
    });
  }
}

export async function detectEviction(): Promise<boolean> {
  // If DB is empty but we expect a profile (SW cache exists), data was evicted
  const profile = await getProfile();
  if (!profile && navigator.serviceWorker?.controller) {
    eventBus.emit('storage-eviction-detected');
    return true;
  }
  return false;
}
