import { createElement } from '../utils/dom';

export function createStorageWarning(percent: number): HTMLElement {
  const warning = createElement('div', { className: 'storage-warning' });
  warning.setAttribute('role', 'alert');

  warning.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E65100" stroke-width="2" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
    <span>Storage is ${Math.round(percent * 100)}% full. Sync your data and consider freeing space.</span>
    <button class="storage-warning__dismiss" aria-label="Dismiss">\u00D7</button>
  `;

  warning.querySelector('.storage-warning__dismiss')?.addEventListener('click', () => {
    warning.remove();
  });

  return warning;
}

const style = document.createElement('style');
style.textContent = `
  .storage-warning {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: #FFF3E0;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: #E65100;
  }
  .storage-warning__dismiss {
    background: none;
    border: none;
    color: #E65100;
    font-size: var(--font-size-lg);
    cursor: pointer;
    min-width: var(--tap-target-min);
    min-height: var(--tap-target-min);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
  }
`;
document.head.appendChild(style);
