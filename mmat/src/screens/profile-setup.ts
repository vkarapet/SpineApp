import { clearContainer, createElement } from '../utils/dom';
import { createFormField } from '../components/form-field';
import { createButton } from '../components/button';
import { validateParticipantId } from '../utils/validation';
import { createProfile } from '../services/profile-service';
import { router } from '../main';

export function renderProfileSetup(container: HTMLElement): void {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'profile-setup-screen' });
  wrapper.setAttribute('role', 'main');

  const header = createElement('header', { className: 'profile-setup-screen__header' });
  header.appendChild(
    createElement('h1', {
      className: 'profile-setup-screen__title',
      textContent: 'Create Your Profile',
    }),
  );
  header.appendChild(
    createElement('p', {
      className: 'profile-setup-screen__subtitle',
      textContent: 'Enter your assigned participant ID to get started.',
    }),
  );

  const form = createElement('div', { className: 'profile-setup-screen__form' });

  let participantIdValid = false;

  const updateSubmitState = () => {
    submitBtn.disabled = !participantIdValid;
    submitBtn.classList.toggle('btn--disabled', !participantIdValid);
  };

  const participantIdField = createFormField({
    id: 'participant-id',
    label: 'Participant ID',
    type: 'text',
    inputMode: 'text',
    required: true,
    placeholder: 'e.g. ABC123',
    validate: validateParticipantId,
    onChange: (_val, valid) => {
      participantIdValid = valid;
      updateSubmitState();
    },
  });

  const nameField = createFormField({
    id: 'display-name',
    label: 'Name (optional)',
    type: 'text',
    inputMode: 'text',
    autocapitalize: 'words',
    placeholder: 'Your name (local only)',
  });

  form.appendChild(participantIdField.container);
  form.appendChild(nameField.container);

  // Dominant hand selector
  let selectedHand: 'left' | 'right' = 'right';

  const handLabel = createElement('label', {
    className: 'profile-setup-screen__label',
    textContent: 'Dominant Hand',
  });

  const handGroup = createElement('div', { className: 'profile-setup-screen__hand-group' });
  handGroup.setAttribute('role', 'radiogroup');
  handGroup.setAttribute('aria-label', 'Dominant hand');

  const leftBtn = createElement('button', {
    className: 'profile-setup-screen__hand-btn',
    textContent: 'Left',
    'aria-pressed': 'false',
  });

  const rightBtn = createElement('button', {
    className: 'profile-setup-screen__hand-btn profile-setup-screen__hand-btn--active',
    textContent: 'Right',
    'aria-pressed': 'true',
  });

  function updateHandSelection(): void {
    leftBtn.classList.toggle('profile-setup-screen__hand-btn--active', selectedHand === 'left');
    leftBtn.setAttribute('aria-pressed', String(selectedHand === 'left'));
    rightBtn.classList.toggle('profile-setup-screen__hand-btn--active', selectedHand === 'right');
    rightBtn.setAttribute('aria-pressed', String(selectedHand === 'right'));
  }

  leftBtn.addEventListener('click', () => { selectedHand = 'left'; updateHandSelection(); });
  rightBtn.addEventListener('click', () => { selectedHand = 'right'; updateHandSelection(); });

  handGroup.appendChild(leftBtn);
  handGroup.appendChild(rightBtn);

  form.appendChild(handLabel);
  form.appendChild(handGroup);

  const submitBtn = createButton({
    text: 'Continue',
    variant: 'primary',
    fullWidth: true,
    disabled: true,
    onClick: async () => {
      if (!participantIdField.isValid()) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating profile...';

      try {
        await createProfile({
          participantId: participantIdField.getValue(),
          name: nameField.getValue() || undefined,
          dominantHand: selectedHand,
        });
        router.navigate('#/menu');
      } catch (err) {
        console.error('Failed to create profile:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continue';
      }
    },
  });

  const actions = createElement('div', { className: 'profile-setup-screen__actions' });
  actions.appendChild(submitBtn);

  wrapper.appendChild(header);
  wrapper.appendChild(form);
  wrapper.appendChild(actions);
  container.appendChild(wrapper);

}

// Styles
const style = document.createElement('style');
style.textContent = `
  .profile-setup-screen {
    display: flex;
    flex-direction: column;
    padding: var(--space-6) var(--space-4) calc(var(--space-8) + var(--safe-area-bottom));
    max-width: 28rem;
    margin: 0 auto;
  }
  .profile-setup-screen__header {
    text-align: center;
    margin-bottom: var(--space-8);
  }
  .profile-setup-screen__title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
  }
  .profile-setup-screen__subtitle {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    margin-top: var(--space-2);
  }
  .profile-setup-screen__form {
  }
  .profile-setup-screen__label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-2);
    margin-top: var(--space-4);
  }
  .profile-setup-screen__hand-group {
    display: flex;
    gap: var(--space-2);
  }
  .profile-setup-screen__hand-btn {
    flex: 1;
    min-height: var(--tap-target-min);
    padding: var(--space-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-base);
    cursor: pointer;
  }
  .profile-setup-screen__hand-btn--active {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;
  }
  .profile-setup-screen__actions {
    padding-top: var(--space-6);
  }
`;
document.head.appendChild(style);
