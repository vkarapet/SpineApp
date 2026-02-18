import { createElement } from '../utils/dom';

export function showConfirm(
  message: string,
  options?: { confirmText?: string; cancelText?: string; variant?: 'default' | 'danger' },
): Promise<boolean> {
  const { confirmText = 'Confirm', cancelText = 'Cancel', variant = 'default' } = options ?? {};

  return new Promise((resolve) => {
    const overlay = createElement('div', { className: 'confirm-dialog__overlay' });

    const dialog = createElement('div', { className: 'confirm-dialog' });
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'confirm-title');
    dialog.setAttribute('aria-describedby', 'confirm-message');

    const title = createElement('h2', {
      id: 'confirm-title',
      className: 'confirm-dialog__title',
      textContent: 'Please Confirm',
    });

    const msg = createElement('p', {
      id: 'confirm-message',
      className: 'confirm-dialog__message',
      textContent: message,
    });

    const actions = createElement('div', { className: 'confirm-dialog__actions' });

    const cancelBtn = createElement('button', {
      className: 'confirm-dialog__btn confirm-dialog__btn--cancel',
      textContent: cancelText,
    });

    const confirmBtn = createElement('button', {
      className: `confirm-dialog__btn confirm-dialog__btn--${variant === 'danger' ? 'danger' : 'confirm'}`,
      textContent: confirmText,
    });

    function close(result: boolean): void {
      overlay.remove();
      resolve(result);
    }

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(title);
    dialog.appendChild(msg);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    confirmBtn.focus();
  });
}

export interface DetailRow {
  label: string;
  value: string;
}

export function showDetail(
  title: string,
  rows: DetailRow[],
  options?: { closeText?: string },
): Promise<void> {
  const { closeText = 'Close' } = options ?? {};

  return new Promise((resolve) => {
    const overlay = createElement('div', { className: 'confirm-dialog__overlay' });

    const dialog = createElement('div', { className: 'confirm-dialog' });
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const heading = createElement('h2', {
      className: 'confirm-dialog__title',
      textContent: title,
    });

    const list = createElement('dl', { className: 'confirm-dialog__detail-list' });
    for (const row of rows) {
      list.appendChild(createElement('dt', { className: 'confirm-dialog__detail-label', textContent: row.label }));
      list.appendChild(createElement('dd', { className: 'confirm-dialog__detail-value', textContent: row.value }));
    }

    const actions = createElement('div', { className: 'confirm-dialog__actions' });
    const closeBtn = createElement('button', {
      className: 'confirm-dialog__btn confirm-dialog__btn--confirm',
      textContent: closeText,
    });

    function close(): void {
      overlay.remove();
      resolve();
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    actions.appendChild(closeBtn);
    dialog.appendChild(heading);
    dialog.appendChild(list);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    closeBtn.focus();
  });
}

export function showPrompt(
  message: string,
  options?: { title?: string; placeholder?: string; confirmText?: string; cancelText?: string },
): Promise<string | null> {
  const {
    title = 'Please Confirm',
    placeholder = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
  } = options ?? {};

  return new Promise((resolve) => {
    const overlay = createElement('div', { className: 'confirm-dialog__overlay' });

    const dialog = createElement('div', { className: 'confirm-dialog' });
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');

    const heading = createElement('h2', {
      className: 'confirm-dialog__title',
      textContent: title,
    });

    const msg = createElement('p', {
      className: 'confirm-dialog__message',
      textContent: message,
    });

    const input = createElement('input', {
      className: 'confirm-dialog__input',
    }) as HTMLInputElement;
    input.type = 'text';
    input.placeholder = placeholder;

    const actions = createElement('div', { className: 'confirm-dialog__actions' });

    const cancelBtn = createElement('button', {
      className: 'confirm-dialog__btn confirm-dialog__btn--cancel',
      textContent: cancelText,
    });

    const confirmBtn = createElement('button', {
      className: 'confirm-dialog__btn confirm-dialog__btn--confirm',
      textContent: confirmText,
    });

    function close(result: string | null): void {
      overlay.remove();
      resolve(result);
    }

    cancelBtn.addEventListener('click', () => close(null));
    confirmBtn.addEventListener('click', () => close(input.value));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(heading);
    dialog.appendChild(msg);
    dialog.appendChild(input);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    input.focus();
  });
}

const style = document.createElement('style');
style.textContent = `
  .confirm-dialog__overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: calc(var(--z-toast) + 1);
    padding: var(--space-4);
  }
  .confirm-dialog {
    background: var(--color-bg);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    max-width: 22rem;
    width: 100%;
    box-shadow: var(--shadow-lg);
  }
  .confirm-dialog__title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--space-3);
  }
  .confirm-dialog__message {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    line-height: var(--line-height-relaxed);
    margin-bottom: var(--space-6);
  }
  .confirm-dialog__actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
  }
  .confirm-dialog__btn {
    min-height: var(--tap-target-min);
    padding: var(--space-2) var(--space-5);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .confirm-dialog__btn--cancel {
    background: var(--color-bg-secondary);
    color: var(--color-text);
  }
  .confirm-dialog__btn--cancel:active {
    background: var(--color-bg-tertiary);
  }
  .confirm-dialog__btn--confirm {
    background: var(--color-primary);
    color: #fff;
  }
  .confirm-dialog__btn--confirm:active {
    background: var(--color-primary-dark);
  }
  .confirm-dialog__btn--danger {
    background: var(--color-error);
    color: #fff;
  }
  .confirm-dialog__btn--danger:active {
    opacity: 0.8;
  }
  .confirm-dialog__detail-list {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-1) var(--space-3);
    margin-bottom: var(--space-6);
  }
  .confirm-dialog__detail-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .confirm-dialog__detail-value {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    text-align: right;
  }
  .confirm-dialog__input {
    width: 100%;
    box-sizing: border-box;
    min-height: var(--tap-target-min);
    padding: var(--space-2) var(--space-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    margin-bottom: var(--space-6);
  }
  .confirm-dialog__input:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`;
document.head.appendChild(style);
