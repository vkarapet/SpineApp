import { clearContainer, createElement } from '../utils/dom';
import { createFormField, type FormFieldRef } from '../components/form-field';
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

  const fields: FormFieldRef[] = [participantIdField, nameField];

  for (const field of fields) {
    form.appendChild(field.container);
  }

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
        });
        router.navigate('#/data-restore');
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

  // Focus first field
  setTimeout(() => participantIdField.input.focus(), 100);
}

// Styles
const style = document.createElement('style');
style.textContent = `
  .profile-setup-screen {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
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
    flex: 1;
  }
  .profile-setup-screen__actions {
    padding-top: var(--space-6);
  }
`;
document.head.appendChild(style);
