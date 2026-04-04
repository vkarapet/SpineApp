import { createElement } from '../utils/dom';
import { formatRelativeTime, daysSince } from '../utils/date';
import { isIOS } from '../utils/device';
import { IOS_SYNC_WARNING_DAYS } from '../constants';

export interface SyncStatusConfig {
  pendingCount: number;
  lastSyncedAt: string | null;
  onSyncNow: () => void;
}

export function createSyncStatus(config: SyncStatusConfig): HTMLElement {
  const { pendingCount, lastSyncedAt, onSyncNow } = config;

  const container = createElement('div', { className: 'sync-status' });
  container.setAttribute('aria-live', 'polite');

  const statusRow = createElement('div', { className: 'sync-status__row' });

  const icon = createElement('span', { className: 'sync-status__icon' });
  if (pendingCount === 0) {
    icon.innerHTML = `<svg width="20" height="20" viewBox="-1 -1 26 26" fill="none" stroke="#34A853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    icon.setAttribute('aria-label', 'All synced');
  } else {
    icon.innerHTML = `<svg width="20" height="20" viewBox="-1 -1 26 26" fill="none" stroke="#FF6D00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="#FF6D00"/></svg>`;
    icon.setAttribute('aria-label', `${pendingCount} sessions pending sync`);
  }

  const text = createElement('div', { className: 'sync-status__text' });
  if (pendingCount === 0) {
    text.textContent = 'All synced';
  } else {
    text.textContent = `${pendingCount} session${pendingCount !== 1 ? 's' : ''} pending sync`;
  }

  statusRow.appendChild(icon);
  statusRow.appendChild(text);

  const syncBtn = createElement('button', {
    className: 'sync-status__btn',
    textContent: 'Sync Now',
    'aria-label': 'Sync data now',
  });
  syncBtn.addEventListener('click', onSyncNow);
  statusRow.appendChild(syncBtn);

  container.appendChild(statusRow);

  if (lastSyncedAt) {
    const lastSync = createElement('p', {
      className: 'sync-status__last',
      textContent: `Last synced: ${formatRelativeTime(lastSyncedAt)}`,
    });
    container.appendChild(lastSync);

    // iOS 5-day warning
    if (isIOS() && daysSince(lastSyncedAt) >= IOS_SYNC_WARNING_DAYS) {
      const warning = createElement('div', {
        className: 'sync-status__warning',
      });
      warning.setAttribute('role', 'alert');
      warning.textContent = 'Open the app regularly to prevent data loss';
      container.appendChild(warning);
    }
  }

  return container;
}

const style = document.createElement('style');
style.textContent = `
  .sync-status {
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }
  .sync-status__row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .sync-status__icon {
    display: flex;
    flex-shrink: 0;
  }
  .sync-status__text {
    flex: 1;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }
  .sync-status__btn {
    min-height: var(--tap-target-min);
    padding: var(--space-2) var(--space-4);
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    flex-shrink: 0;
  }
  .sync-status__btn:active {
    background: var(--color-primary-dark);
  }
  .sync-status__last {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    margin-top: var(--space-2);
  }
  .sync-status__warning {
    margin-top: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: #FFF3E0;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    color: #E65100;
  }
`;
document.head.appendChild(style);
