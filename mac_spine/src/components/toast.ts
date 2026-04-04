import { createElement } from '../utils/dom';

let toastContainer: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = createElement('div', { className: 'toast-container' });
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('role', 'status');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  autoDismiss = true,
): HTMLDivElement {
  const container = ensureContainer();

  const toast = createElement('div', {
    className: `toast toast--${type}`,
    textContent: message,
  });

  const dismissBtn = createElement('button', {
    className: 'toast__dismiss',
    textContent: '\u00D7',
    'aria-label': 'Dismiss notification',
  });
  dismissBtn.addEventListener('click', () => toast.remove());
  toast.appendChild(dismissBtn);

  container.appendChild(toast);

  if (autoDismiss) {
    setTimeout(() => toast.remove(), 2000);
  }

  return toast;
}

// Inject toast styles
const style = document.createElement('style');
style.textContent = `
  .toast-container {
    position: fixed;
    bottom: calc(var(--space-4) + var(--safe-area-bottom));
    left: var(--space-4);
    right: var(--space-4);
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    pointer-events: auto;
    box-shadow: var(--shadow-md);
  }
  .toast--info {
    background: var(--color-text);
    color: #fff;
  }
  .toast--success {
    background: var(--color-success);
    color: #fff;
  }
  .toast--error {
    background: var(--color-error);
    color: #fff;
  }
  .toast__dismiss {
    background: none;
    border: none;
    color: inherit;
    font-size: var(--font-size-lg);
    cursor: pointer;
    min-width: var(--tap-target-min);
    min-height: var(--tap-target-min);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: calc(var(--space-3) * -1);
    padding: var(--space-3);
  }
`;
document.head.appendChild(style);
