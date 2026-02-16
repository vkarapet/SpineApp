import { clearContainer, createElement } from '../utils/dom';
import { createHeader } from '../components/header';
import { createFormField } from '../components/form-field';
import { createButton } from '../components/button';
import { getProfile } from '../core/db';
import { updateProfileName } from '../services/profile-service';
import { validateName } from '../utils/validation';
import { formatDate } from '../utils/date';
import { showToast } from '../components/toast';
import { router } from '../main';

export async function renderProfileView(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const profile = await getProfile();
  if (!profile) {
    router.navigate('#/splash', true);
    return;
  }

  const header = createHeader({
    title: 'Profile',
    showBack: true,
    onBack: () => router.navigate('#/menu'),
  });

  const main = createElement('main', { className: 'profile-view-screen' });
  main.setAttribute('role', 'main');

  // Editable fields
  const firstNameField = createFormField({
    id: 'edit-first-name',
    label: 'First Name',
    type: 'text',
    inputMode: 'text',
    autocapitalize: 'words',
    value: profile.first_name,
    validate: (v) => validateName(v, 'First name'),
  });

  const lastNameField = createFormField({
    id: 'edit-last-name',
    label: 'Last Name',
    type: 'text',
    inputMode: 'text',
    autocapitalize: 'words',
    value: profile.last_name,
    validate: (v) => validateName(v, 'Last name'),
  });

  // Read-only fields
  const emailField = createFormField({
    id: 'view-email',
    label: 'Email',
    type: 'email',
    value: profile.email,
    readOnly: true,
  });

  const dobField = createFormField({
    id: 'view-dob',
    label: 'Date of Birth',
    type: 'text',
    value: formatDate(profile.dob),
    readOnly: true,
  });

  const readonlyNote = createElement('p', {
    className: 'profile-view-screen__note',
    textContent:
      'Email and date of birth are used to identify your data and cannot be changed. If your email has changed, contact the research team for assistance.',
  });

  const saveBtn = createButton({
    text: 'Save Changes',
    variant: 'primary',
    fullWidth: true,
    onClick: async () => {
      if (!firstNameField.isValid() || !lastNameField.isValid()) return;
      await updateProfileName(firstNameField.getValue(), lastNameField.getValue());
      showToast('Profile updated', 'success');
      router.navigate('#/menu');
    },
  });

  main.appendChild(firstNameField.container);
  main.appendChild(lastNameField.container);
  main.appendChild(emailField.container);
  main.appendChild(dobField.container);
  main.appendChild(readonlyNote);
  main.appendChild(saveBtn);

  container.appendChild(header);
  container.appendChild(main);
}

const style = document.createElement('style');
style.textContent = `
  .profile-view-screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    padding-bottom: calc(var(--space-8) + var(--safe-area-bottom));
    max-width: 28rem;
    margin: 0 auto;
  }
  .profile-view-screen__note {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    line-height: var(--line-height-relaxed);
    padding: var(--space-3);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }
`;
document.head.appendChild(style);
