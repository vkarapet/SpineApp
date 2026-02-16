import { createElement } from '../utils/dom';

export function createUpdateBanner(onUpdate: () => void): HTMLElement {
  const banner = createElement('div', { className: 'update-banner' });
  banner.setAttribute('role', 'alert');

  const text = createElement('span', {
    textContent: 'A new version is available.',
  });

  const btn = createElement('button', {
    className: 'update-banner__btn',
    textContent: 'Tap to update',
  });
  btn.addEventListener('click', onUpdate);

  const dismiss = createElement('button', {
    className: 'update-banner__dismiss',
    textContent: '\u00D7',
    'aria-label': 'Dismiss',
  });
  dismiss.addEventListener('click', () => banner.remove());

  banner.appendChild(text);
  banner.appendChild(btn);
  banner.appendChild(dismiss);
  return banner;
}

const style = document.createElement('style');
style.textContent = `
  .update-banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--color-primary);
    color: #fff;
    font-size: var(--font-size-sm);
  }
  .update-banner__btn {
    background: rgba(255,255,255,0.2);
    color: #fff;
    border: none;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    min-height: var(--tap-target-min);
  }
  .update-banner__dismiss {
    background: none;
    border: none;
    color: #fff;
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
