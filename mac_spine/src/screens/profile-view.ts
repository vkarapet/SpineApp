import { clearContainer, createElement } from '../utils/dom';
import { createHeader } from '../components/header';
import { createFormField } from '../components/form-field';
import { createButton } from '../components/button';
import { getProfile } from '../core/db';
import { updateProfile } from '../services/profile-service';
import { validateParticipantId } from '../utils/validation';
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

  const participantIdField = createFormField({
    id: 'edit-participant-id',
    label: 'Participant ID',
    type: 'text',
    inputMode: 'text',
    value: profile.participant_id,
    validate: validateParticipantId,
  });

  const nameField = createFormField({
    id: 'edit-name',
    label: 'Name (optional)',
    type: 'text',
    inputMode: 'text',
    autocapitalize: 'words',
    value: profile.name,
  });

  const saveBtn = createButton({
    text: 'Save Changes',
    variant: 'primary',
    fullWidth: true,
    onClick: async () => {
      if (!participantIdField.isValid()) return;
      await updateProfile(participantIdField.getValue(), nameField.getValue());
      showToast('Profile updated', 'success');
      router.navigate('#/menu');
    },
  });

  main.appendChild(participantIdField.container);
  main.appendChild(nameField.container);
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
`;
document.head.appendChild(style);
