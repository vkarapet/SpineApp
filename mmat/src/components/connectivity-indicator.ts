import { eventBus } from '../main';

export function initConnectivityMonitor(): void {
  const update = () => {
    const el = document.getElementById('connectivity-indicator');
    if (!el) return;

    const online = navigator.onLine;
    el.setAttribute('aria-label', online ? 'Online' : 'Offline');
    el.innerHTML = online
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EA4335" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="4" y1="4" x2="20" y2="20"/></svg>`;

    eventBus.emit('online-status', online);
  };

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
}
