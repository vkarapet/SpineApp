import { createElement } from '../utils/dom';

const DISCARD_OPTIONS = [
  { value: 'incorrect_placement', label: 'Incorrect phone placement' },
  { value: 'interrupted', label: 'Interrupted during test' },
  { value: 'instructions', label: 'Did not follow instructions correctly' },
  { value: 'no_detection', label: 'Phone not detecting movement' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * Show the discard reason dialog.
 * Returns the selected reason string, or null if the user cancelled.
 */
export function showDiscardDialog(): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = createElement('div', { className: 'discard-dialog__overlay' });

    const dialog = createElement('div', { className: 'discard-dialog' });
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'discard-title');

    dialog.appendChild(
      createElement('h2', {
        id: 'discard-title',
        className: 'discard-dialog__title',
        textContent: 'Why are you discarding this session?',
      }),
    );
    dialog.appendChild(
      createElement('p', {
        className: 'discard-dialog__subtitle',
        textContent: 'The result will still be recorded and synced, but marked as discarded.',
      }),
    );

    let selectedValue: string | null = null;

    const optionsList = createElement('div', { className: 'discard-dialog__options' });
    let otherInput: HTMLTextAreaElement | null = null;

    for (const option of DISCARD_OPTIONS) {
      const row = createElement('label', { className: 'discard-dialog__option' });

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'discard-reason';
      radio.value = option.value;
      radio.className = 'discard-dialog__radio';

      const labelText = createElement('span', {
        className: 'discard-dialog__option-label',
        textContent: option.label,
      });

      row.appendChild(radio);
      row.appendChild(labelText);
      optionsList.appendChild(row);

      if (option.value === 'other') {
        const otherTextarea = document.createElement('textarea');
        otherTextarea.className = 'discard-dialog__other-input';
        otherTextarea.placeholder = 'Please describe…';
        otherTextarea.rows = 2;
        otherTextarea.style.display = 'none';
        optionsList.appendChild(otherTextarea);
        otherInput = otherTextarea;
      }

      radio.addEventListener('change', () => {
        if (radio.checked) {
          selectedValue = option.value;
          confirmBtn.disabled = false;
          confirmBtn.classList.remove('discard-dialog__btn--disabled');
          if (otherInput) {
            otherInput.style.display = option.value === 'other' ? 'block' : 'none';
          }
        }
      });
    }

    dialog.appendChild(optionsList);

    const actions = createElement('div', { className: 'discard-dialog__actions' });

    const cancelBtn = createElement('button', {
      className: 'discard-dialog__btn discard-dialog__btn--cancel',
      textContent: 'Go Back',
    });

    const confirmBtn = createElement('button', {
      className: 'discard-dialog__btn discard-dialog__btn--confirm discard-dialog__btn--disabled',
      textContent: 'Confirm Discard',
    });
    (confirmBtn as HTMLButtonElement).disabled = true;

    function close(reason: string | null): void {
      overlay.remove();
      resolve(reason);
    }

    cancelBtn.addEventListener('click', () => close(null));

    confirmBtn.addEventListener('click', () => {
      if (!selectedValue) return;
      let reason: string;
      if (selectedValue === 'other') {
        const text = otherInput?.value.trim() ?? '';
        reason = text ? `Other: ${text}` : 'Other';
      } else {
        reason = DISCARD_OPTIONS.find((o) => o.value === selectedValue)!.label;
      }
      close(reason);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus the dialog for accessibility
    dialog.setAttribute('tabindex', '-1');
    requestAnimationFrame(() => (dialog as HTMLElement).focus());
  });
}

const style = document.createElement('style');
style.textContent = `
  .discard-dialog__overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: var(--z-modal, 1000);
    padding: 0;
  }
  .discard-dialog {
    background: var(--color-bg);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    padding: var(--space-6) var(--space-4) calc(var(--space-6) + env(safe-area-inset-bottom));
    width: 100%;
    max-width: 32rem;
    max-height: 90vh;
    overflow-y: auto;
    outline: none;
  }
  .discard-dialog__title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--space-2);
  }
  .discard-dialog__subtitle {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-5);
  }
  .discard-dialog__options {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-5);
  }
  .discard-dialog__option {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    min-height: var(--tap-target-min);
  }
  .discard-dialog__option:has(input:checked) {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }
  .discard-dialog__radio {
    width: 1.125rem;
    height: 1.125rem;
    flex-shrink: 0;
    accent-color: var(--color-primary);
  }
  .discard-dialog__option-label {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
  }
  .discard-dialog__other-input {
    width: 100%;
    box-sizing: border-box;
    margin-top: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-family: inherit;
    background: var(--color-bg);
    color: var(--color-text);
    resize: none;
  }
  .discard-dialog__actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .discard-dialog__btn {
    width: 100%;
    min-height: var(--tap-target-preferred);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    border: none;
    transition: opacity 0.15s;
  }
  .discard-dialog__btn--confirm {
    background: #C62828;
    color: #fff;
  }
  .discard-dialog__btn--confirm.discard-dialog__btn--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .discard-dialog__btn--cancel {
    background: var(--color-bg-secondary);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }
`;
document.head.appendChild(style);
