import { clearContainer, createElement } from '../utils/dom';
import { createButton } from '../components/button';
import { pendingProfileData } from './profile-setup';
import { createProfile } from '../services/profile-service';
import { formatDate } from '../utils/date';
import { router } from '../main';

export function renderConfirmation(container: HTMLElement): void {
  clearContainer(container);

  if (!pendingProfileData) {
    router.navigate('#/profile-setup', true);
    return;
  }

  const data = pendingProfileData;

  const wrapper = createElement('main', { className: 'confirmation-screen' });
  wrapper.setAttribute('role', 'main');

  const header = createElement('h1', {
    className: 'confirmation-screen__title',
    textContent: 'Please verify your information',
  });

  const card = createElement('section', { className: 'confirmation-screen__card' });
  card.innerHTML = `
    <div class="confirmation-screen__field">
      <span class="confirmation-screen__label">Name</span>
      <span class="confirmation-screen__value">${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</span>
    </div>
    <div class="confirmation-screen__field">
      <span class="confirmation-screen__label">Date of Birth</span>
      <span class="confirmation-screen__value">${formatDate(data.dob)}</span>
    </div>
    <div class="confirmation-screen__field">
      <span class="confirmation-screen__label">Email</span>
      <span class="confirmation-screen__value">${escapeHtml(data.email)}</span>
    </div>
  `;

  const warning = createElement('div', { className: 'confirmation-screen__warning' });
  warning.setAttribute('role', 'alert');
  warning.innerHTML = `
    <strong>Important:</strong> Your email and date of birth are used to link your data
    across devices. Please ensure they are correct — they cannot be changed later.
  `;

  const confirmBtn = createButton({
    text: 'Confirm & Continue',
    variant: 'primary',
    fullWidth: true,
    onClick: async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Creating profile...';

      try {
        await createProfile({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          dob: data.dob,
        });
        router.navigate('#/data-restore');
      } catch (err) {
        console.error('Failed to create profile:', err);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm & Continue';
      }
    },
  });

  const editBtn = createButton({
    text: 'Go Back & Edit',
    variant: 'secondary',
    fullWidth: true,
    onClick: () => {
      router.navigate('#/profile-setup');
    },
  });

  const actions = createElement('div', { className: 'confirmation-screen__actions' });
  actions.appendChild(confirmBtn);
  actions.appendChild(editBtn);

  wrapper.appendChild(header);
  wrapper.appendChild(card);
  wrapper.appendChild(warning);
  wrapper.appendChild(actions);
  container.appendChild(wrapper);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Styles
const style = document.createElement('style');
style.textContent = `
  .confirmation-screen {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    padding: var(--space-6) var(--space-4) calc(var(--space-8) + var(--safe-area-bottom));
    max-width: 28rem;
    margin: 0 auto;
  }
  .confirmation-screen__title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    text-align: center;
    margin-bottom: var(--space-8);
  }
  .confirmation-screen__card {
    background: var(--color-bg-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
  }
  .confirmation-screen__field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .confirmation-screen__field + .confirmation-screen__field {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }
  .confirmation-screen__label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium);
  }
  .confirmation-screen__value {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
  }
  .confirmation-screen__warning {
    margin-top: var(--space-6);
    padding: var(--space-4);
    background: #FFF3E0;
    border-radius: var(--radius-md);
    border-left: 4px solid var(--color-warning);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
  }
  .confirmation-screen__actions {
    margin-top: auto;
    padding-top: var(--space-6);
  }
`;
document.head.appendChild(style);
