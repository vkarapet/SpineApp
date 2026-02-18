import { eventBus } from '../main';

let initialized = false;

export function initConnectivityService(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('online', () => {
    eventBus.emit('online-status', true);
    // Auto-sync when connectivity is restored
    import('./sync-service')
      .then((mod) => mod.triggerSync())
      .catch(() => { /* sync will retry later */ });
  });
  window.addEventListener('offline', () => eventBus.emit('online-status', false));
}

export function isOnline(): boolean {
  return navigator.onLine;
}
