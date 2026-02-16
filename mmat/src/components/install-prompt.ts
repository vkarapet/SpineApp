import { createElement } from '../utils/dom';
import { createButton } from './button';
import { isIOS } from '../utils/device';

export function createInstallPrompt(
  onInstall: () => void,
  onDismiss: () => void,
): HTMLElement {
  const overlay = createElement('div', { className: 'install-prompt-overlay' });

  const prompt = createElement('div', { className: 'install-prompt' });
  prompt.setAttribute('role', 'dialog');
  prompt.setAttribute('aria-label', 'Install MMAT');

  if (isIOS()) {
    prompt.innerHTML = `
      <h2>Add MMAT to your Home Screen</h2>
      <p>For the best experience, install MMAT as an app:</p>
      <ol class="install-prompt__steps">
        <li>
          <span class="install-prompt__step-icon">1</span>
          Tap the Share button <span aria-label="share icon">\u{1F4E4}</span>
        </li>
        <li>
          <span class="install-prompt__step-icon">2</span>
          Scroll down and tap "Add to Home Screen"
        </li>
        <li>
          <span class="install-prompt__step-icon">3</span>
          Tap "Add"
        </li>
      </ol>
    `;
  } else {
    prompt.innerHTML = `
      <h2>Install MMAT</h2>
      <p>Add MMAT to your home screen for the best experience.</p>
    `;
  }

  const actions = createElement('div', { className: 'install-prompt__actions' });

  if (!isIOS()) {
    actions.appendChild(
      createButton({
        text: 'Install',
        variant: 'primary',
        fullWidth: true,
        onClick: () => {
          onInstall();
          overlay.remove();
        },
      }),
    );
  }

  actions.appendChild(
    createButton({
      text: 'Not Now',
      variant: 'text',
      fullWidth: true,
      onClick: () => {
        onDismiss();
        overlay.remove();
      },
    }),
  );

  prompt.appendChild(actions);
  overlay.appendChild(prompt);

  return overlay;
}

const style = document.createElement('style');
style.textContent = `
  .install-prompt-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: var(--z-modal);
    padding: var(--space-4);
  }
  .install-prompt {
    background: var(--color-bg);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    padding: var(--space-6);
    width: 100%;
    max-width: 24rem;
  }
  .install-prompt h2 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--space-3);
  }
  .install-prompt p {
    color: var(--color-text-secondary);
    margin-bottom: var(--space-4);
  }
  .install-prompt__steps {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  .install-prompt__steps li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--font-size-base);
  }
  .install-prompt__step-icon {
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
  }
  .install-prompt__actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
`;
document.head.appendChild(style);
