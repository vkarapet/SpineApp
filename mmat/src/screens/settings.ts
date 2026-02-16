import { clearContainer, createElement } from '../utils/dom';
import { createHeader } from '../components/header';
import { createButton } from '../components/button';
import { getUnsyncedResults } from '../core/db';
import { updatePreference, getPreferences } from '../services/settings-service';
import { signOut } from '../services/profile-service';
import { deleteAllData } from '../services/data-deletion-service';
import { getStorageEstimate } from '../utils/storage';
import { supportsVibration } from '../utils/device';
import { showToast } from '../components/toast';
import { APP_VERSION, INTENDED_USE_STATEMENT } from '../constants';
import { router } from '../main';

export async function renderSettings(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const header = createHeader({
    title: 'Settings',
    showBack: true,
    onBack: () => router.navigate('#/menu'),
  });

  const main = createElement('main', { className: 'settings-screen' });
  main.setAttribute('role', 'main');

  const prefs = await getPreferences();
  if (!prefs) {
    router.navigate('#/splash', true);
    return;
  }

  // Audio toggle
  main.appendChild(
    createToggleRow('Audio', 'Countdown beeps and GO tone', prefs.audio_enabled, async (val) => {
      await updatePreference('audio_enabled', val);
    }),
  );

  // Haptic toggle — hidden on iOS
  if (supportsVibration()) {
    main.appendChild(
      createToggleRow('Haptic feedback', 'Vibration on taps', prefs.haptic_enabled, async (val) => {
        await updatePreference('haptic_enabled', val);
      }),
    );
  }

  // Dominant hand
  main.appendChild(createSectionHeader('Dominant Hand'));
  const handGroup = createElement('div', { className: 'settings-screen__hand-group' });
  handGroup.setAttribute('role', 'radiogroup');
  handGroup.setAttribute('aria-label', 'Dominant hand');

  for (const hand of ['left', 'right'] as const) {
    const btn = createElement('button', {
      className: `settings-screen__hand-btn ${prefs.dominant_hand === hand ? 'settings-screen__hand-btn--active' : ''}`,
      textContent: hand.charAt(0).toUpperCase() + hand.slice(1),
      'aria-pressed': prefs.dominant_hand === hand ? 'true' : 'false',
    });
    btn.addEventListener('click', async () => {
      await updatePreference('dominant_hand', hand);
      handGroup.querySelectorAll('.settings-screen__hand-btn').forEach((b) => {
        b.classList.remove('settings-screen__hand-btn--active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('settings-screen__hand-btn--active');
      btn.setAttribute('aria-pressed', 'true');
    });
    handGroup.appendChild(btn);
  }
  main.appendChild(handGroup);

  // Reminders
  main.appendChild(createSectionHeader('Assessment Reminders'));
  const reminderSelect = createElement('select', {
    className: 'settings-screen__select',
    'aria-label': 'Reminder frequency',
  });
  for (const opt of [
    { value: 'off', label: 'Off' },
    { value: 'daily', label: 'Daily' },
    { value: 'every_2_days', label: 'Every 2 days' },
    { value: 'weekly', label: 'Weekly' },
  ]) {
    const option = createElement('option', { textContent: opt.label });
    option.value = opt.value;
    if (prefs.reminder_frequency === opt.value) option.selected = true;
    reminderSelect.appendChild(option);
  }
  reminderSelect.addEventListener('change', async () => {
    await updatePreference(
      'reminder_frequency',
      reminderSelect.value as 'daily' | 'every_2_days' | 'weekly' | 'off',
    );
  });
  main.appendChild(reminderSelect);

  // Data Management
  main.appendChild(createSectionHeader('Data Management'));

  const storageEst = await getStorageEstimate();
  if (storageEst.quota > 0) {
    const storageInfo = createElement('p', {
      className: 'settings-screen__info',
      textContent: `Storage: ${formatBytes(storageEst.usage)} / ${formatBytes(storageEst.quota)} (${Math.round(storageEst.percent * 100)}%)`,
    });
    main.appendChild(storageInfo);
  }

  main.appendChild(
    createButton({
      text: 'Export My Data',
      variant: 'secondary',
      fullWidth: true,
      onClick: async () => {
        const { exportDataAsJSON } = await import('../services/export-service');
        await exportDataAsJSON();
        showToast('Data exported', 'success');
      },
    }),
  );

  // Sign Out
  main.appendChild(
    createButton({
      text: 'Sign Out',
      variant: 'secondary',
      fullWidth: true,
      onClick: async () => {
        const unsynced = await getUnsyncedResults();
        if (unsynced.length > 0) {
          if (
            !confirm(
              `You have ${unsynced.length} unsynced session(s). Signing out will not delete this data, but it won't sync until you sign back in. Continue?`,
            )
          ) {
            return;
          }
        }
        await signOut();
        router.navigate('#/splash', true);
      },
    }),
  );

  // Delete My Data
  main.appendChild(
    createButton({
      text: 'Delete My Data',
      variant: 'danger',
      fullWidth: true,
      onClick: async () => {
        if (
          !confirm(
            'This will permanently delete all your data from this device and the server. This action cannot be undone. Continue?',
          )
        ) {
          return;
        }
        const result = await deleteAllData();
        if (result.success) {
          router.navigate('#/splash', true);
        } else {
          showToast(result.error ?? 'Failed to delete data', 'error');
        }
      },
    }),
  );

  // About
  main.appendChild(createSectionHeader('About'));
  const aboutSection = createElement('div', { className: 'settings-screen__about' });
  aboutSection.innerHTML = `
    <p><strong>MMAT</strong> v${APP_VERSION}</p>
    <p class="settings-screen__intended-use">${INTENDED_USE_STATEMENT}</p>
    <p class="settings-screen__contact">For support, contact the research team.</p>
  `;
  main.appendChild(aboutSection);

  container.appendChild(header);
  container.appendChild(main);
}

function createSectionHeader(text: string): HTMLElement {
  return createElement('h2', {
    className: 'settings-screen__section-header',
    textContent: text,
  });
}

function createToggleRow(
  label: string,
  description: string,
  checked: boolean,
  onChange: (val: boolean) => void,
): HTMLElement {
  const row = createElement('div', { className: 'settings-screen__toggle-row' });

  const textCol = createElement('div', { className: 'settings-screen__toggle-text' });
  textCol.appendChild(createElement('span', { className: 'settings-screen__toggle-label', textContent: label }));
  textCol.appendChild(createElement('span', { className: 'settings-screen__toggle-desc', textContent: description }));

  const toggle = createElement('input', { 'aria-label': label });
  toggle.type = 'checkbox';
  toggle.checked = checked;
  toggle.className = 'settings-screen__toggle';
  toggle.addEventListener('change', () => onChange(toggle.checked));

  row.appendChild(textCol);
  row.appendChild(toggle);
  return row;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const style = document.createElement('style');
style.textContent = `
  .settings-screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    padding-bottom: calc(var(--space-8) + var(--safe-area-bottom));
    max-width: 28rem;
    margin: 0 auto;
  }
  .settings-screen__section-header {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: var(--space-4);
  }
  .settings-screen__toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: var(--tap-target-preferred);
    padding: var(--space-2) 0;
  }
  .settings-screen__toggle-text {
    display: flex;
    flex-direction: column;
  }
  .settings-screen__toggle-label {
    font-weight: var(--font-weight-medium);
  }
  .settings-screen__toggle-desc {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .settings-screen__toggle {
    width: 3rem;
    height: 1.75rem;
    accent-color: var(--color-primary);
    cursor: pointer;
  }
  .settings-screen__hand-group {
    display: flex;
    gap: var(--space-2);
  }
  .settings-screen__hand-btn {
    flex: 1;
    min-height: var(--tap-target-min);
    padding: var(--space-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
  }
  .settings-screen__hand-btn--active {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;
  }
  .settings-screen__select {
    min-height: var(--tap-target-min);
    padding: var(--space-3) var(--space-4);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    background: var(--color-bg);
    width: 100%;
    cursor: pointer;
  }
  .settings-screen__info {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .settings-screen__about {
    padding: var(--space-4);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }
  .settings-screen__about p {
    margin-bottom: var(--space-2);
  }
  .settings-screen__intended-use {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-style: italic;
  }
  .settings-screen__contact {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
`;
document.head.appendChild(style);
