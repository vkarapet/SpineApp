import { eventBus } from '../main';

let pendingUpdate: ServiceWorkerRegistration | null = null;
let assessmentActive = false;

export function initUpdateService(): void {
  // Listen for assessment state
  eventBus.on('assessment-active', (active) => {
    assessmentActive = active as boolean;
  });

  // Listen for SW update found
  eventBus.on('sw-update-found', (registration) => {
    const reg = registration as ServiceWorkerRegistration;
    const newWorker = reg.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        pendingUpdate = reg;
        if (!assessmentActive) {
          showUpdateBanner();
        }
      }
    });
  });
}

function showUpdateBanner(): void {
  eventBus.emit('show-update-banner', {
    onUpdate: () => applyUpdate(),
  });
}

export function applyUpdate(): void {
  if (!pendingUpdate) return;

  const waiting = pendingUpdate.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }
}

export function hasPendingUpdate(): boolean {
  return pendingUpdate !== null;
}
