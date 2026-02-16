import { createElement } from '../utils/dom';

export interface ButtonConfig {
  text: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'text';
  fullWidth?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onClick: () => void;
}

export function createButton(config: ButtonConfig): HTMLButtonElement {
  const {
    text,
    variant = 'primary',
    fullWidth = false,
    disabled = false,
    ariaLabel,
    onClick,
  } = config;

  const classes = ['btn', `btn--${variant}`];
  if (fullWidth) classes.push('btn--full');
  if (disabled) classes.push('btn--disabled');

  const btn = createElement('button', {
    className: classes.join(' '),
    textContent: text,
  });

  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
  if (disabled) btn.disabled = true;

  btn.addEventListener('click', onClick);
  return btn;
}

// Inject button styles
const style = document.createElement('style');
style.textContent = `
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--tap-target-min);
    padding: var(--space-3) var(--space-6);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: background-color var(--transition-fast), opacity var(--transition-fast);
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    text-align: center;
    line-height: var(--line-height-tight);
  }
  .btn--primary {
    background-color: var(--color-primary);
    color: #fff;
  }
  .btn--primary:active {
    background-color: var(--color-primary-dark);
  }
  .btn--secondary {
    background-color: transparent;
    color: var(--color-primary);
    border: 2px solid var(--color-primary);
  }
  .btn--secondary:active {
    background-color: var(--color-bg-secondary);
  }
  .btn--danger {
    background-color: var(--color-error);
    color: #fff;
  }
  .btn--danger:active {
    opacity: 0.8;
  }
  .btn--text {
    background: none;
    color: var(--color-primary);
    padding: var(--space-2) var(--space-3);
    min-height: var(--tap-target-min);
  }
  .btn--text:active {
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }
  .btn--full {
    width: 100%;
  }
  .btn--disabled, .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
  .btn + .btn {
    margin-top: var(--space-2);
  }
`;
document.head.appendChild(style);
