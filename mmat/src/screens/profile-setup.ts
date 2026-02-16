import { clearContainer, createElement } from '../utils/dom';
import { createFormField, type FormFieldRef } from '../components/form-field';
import { createButton } from '../components/button';
import { validateName, validateEmail, validateDOB } from '../utils/validation';
import { router } from '../main';

// Store form data temporarily for confirmation screen
export let pendingProfileData: {
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
} | null = null;

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
      textContent: 'Please enter your information to get started.',
    }),
  );

  const form = createElement('div', { className: 'profile-setup-screen__form' });

  const fields: FormFieldRef[] = [];
  const fieldValidity = { firstName: false, lastName: false, email: false, dob: false };

  const updateSubmitState = () => {
    const allValid = Object.values(fieldValidity).every(Boolean);
    submitBtn.disabled = !allValid;
    submitBtn.classList.toggle('btn--disabled', !allValid);
  };

  const firstNameField = createFormField({
    id: 'first-name',
    label: 'First Name',
    type: 'text',
    inputMode: 'text',
    autocapitalize: 'words',
    required: true,
    placeholder: 'Enter your first name',
    validate: (v) => validateName(v, 'First name'),
    onChange: (_val, valid) => {
      fieldValidity.firstName = valid;
      updateSubmitState();
    },
  });

  const lastNameField = createFormField({
    id: 'last-name',
    label: 'Last Name',
    type: 'text',
    inputMode: 'text',
    autocapitalize: 'words',
    required: true,
    placeholder: 'Enter your last name',
    validate: (v) => validateName(v, 'Last name'),
    onChange: (_val, valid) => {
      fieldValidity.lastName = valid;
      updateSubmitState();
    },
  });

  const emailField = createFormField({
    id: 'email',
    label: 'Email Address',
    type: 'email',
    inputMode: 'email',
    required: true,
    placeholder: 'you@example.com',
    validate: validateEmail,
    onChange: (_val, valid) => {
      fieldValidity.email = valid;
      updateSubmitState();
    },
  });

  const dobField = createFormField({
    id: 'dob',
    label: 'Date of Birth',
    type: 'date',
    required: true,
    validate: validateDOB,
    onChange: (_val, valid) => {
      fieldValidity.dob = valid;
      updateSubmitState();
    },
  });

  fields.push(firstNameField, lastNameField, emailField, dobField);

  for (const field of fields) {
    form.appendChild(field.container);
  }

  const submitBtn = createButton({
    text: 'Continue',
    variant: 'primary',
    fullWidth: true,
    disabled: true,
    onClick: () => {
      // Validate all fields
      const allValid = fields.every((f) => f.isValid());
      if (!allValid) return;

      pendingProfileData = {
        firstName: firstNameField.getValue(),
        lastName: lastNameField.getValue(),
        email: emailField.getValue(),
        dob: dobField.getValue(),
      };

      router.navigate('#/confirmation');
    },
  });

  const actions = createElement('div', { className: 'profile-setup-screen__actions' });
  actions.appendChild(submitBtn);

  wrapper.appendChild(header);
  wrapper.appendChild(form);
  wrapper.appendChild(actions);
  container.appendChild(wrapper);

  // Focus first field
  setTimeout(() => firstNameField.input.focus(), 100);
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
