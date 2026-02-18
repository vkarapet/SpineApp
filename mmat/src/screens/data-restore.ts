import { clearContainer, createElement } from '../utils/dom';
import { createButton } from '../components/button';
import { createLoadingSpinner } from '../components/loading-spinner';
import { getProfile, saveProfile } from '../core/db';
import { router } from '../main';

export async function renderDataRestore(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'data-restore-screen' });
  wrapper.setAttribute('role', 'main');

  if (!navigator.onLine) {
    // Offline — set restoration pending
    const profile = await getProfile();
    if (profile) {
      profile.restoration_pending = true;
      await saveProfile(profile);
    }

    const offlineMsg = createElement('div', { className: 'data-restore-screen__message' });
    offlineMsg.innerHTML = `
      <svg width="48" height="48" viewBox="-1 -1 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <circle cx="12" cy="20" r=".5" fill="currentColor"/>
      </svg>
      <h2>You're offline</h2>
      <p>Your historical data will be restored when you connect to the internet.</p>
    `;

    const continueBtn = createButton({
      text: 'Continue to Home',
      variant: 'primary',
      fullWidth: true,
      onClick: () => router.navigate('#/menu'),
    });

    wrapper.appendChild(offlineMsg);
    wrapper.appendChild(continueBtn);
    container.appendChild(wrapper);
    return;
  }

  // Online — attempt fetch_history
  const spinner = createLoadingSpinner('Checking for existing data...');
  wrapper.appendChild(spinner);
  container.appendChild(wrapper);

  try {
    const profile = await getProfile();
    if (!profile) {
      router.navigate('#/consent', true);
      return;
    }

    // Attempt fetch_history from proxy
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'fetch_history',
        record_id: profile.participant_id,
      }),
    });

    clearContainer(wrapper);

    if (response.ok) {
      const data = await response.json();
      const records = data.records ?? [];

      if (records.length > 0) {
        // Count unique device IDs
        const deviceIds = new Set(records.map((r: { device_id?: string }) => r.device_id));
        const deviceCount = deviceIds.size;

        const successMsg = createElement('div', { className: 'data-restore-screen__message' });
        successMsg.innerHTML = `
          <svg width="48" height="48" viewBox="-1 -1 26 26" fill="none" stroke="#34A853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <h2>Welcome back!</h2>
          <p>We found ${records.length} previous session${records.length !== 1 ? 's' : ''}.</p>
          ${deviceCount > 1 ? `<p>Data from ${deviceCount} device(s) has been restored.</p>` : ''}
        `;
        wrapper.appendChild(successMsg);
      } else {
        const noDataMsg = createElement('div', { className: 'data-restore-screen__message' });
        noDataMsg.innerHTML = `
          <svg width="48" height="48" viewBox="-1 -1 26 26" fill="none" stroke="#1A73E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <h2>No previous data found</h2>
          <p>Let's get started!</p>
        `;
        wrapper.appendChild(noDataMsg);
      }
    } else {
      showFetchError(wrapper);
    }
  } catch {
    clearContainer(wrapper);
    showFetchError(wrapper);
  }

  const continueBtn = createButton({
    text: 'Continue',
    variant: 'primary',
    fullWidth: true,
    onClick: () => router.navigate('#/menu'),
  });

  const actions = createElement('div', { className: 'data-restore-screen__actions' });
  actions.appendChild(continueBtn);
  wrapper.appendChild(actions);
}

function showFetchError(wrapper: HTMLElement): void {
  const errorMsg = createElement('div', { className: 'data-restore-screen__message' });
  errorMsg.innerHTML = `
    <svg width="48" height="48" viewBox="-1 -1 26 26" fill="none" stroke="#FF6D00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <circle cx="12" cy="16" r=".5" fill="#FF6D00"/>
    </svg>
    <h2>Couldn't reach the server</h2>
    <p>Your historical data will be loaded when you connect.</p>
  `;
  wrapper.appendChild(errorMsg);
}

// Styles
const style = document.createElement('style');
style.textContent = `
  .data-restore-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    padding: var(--space-8) var(--space-4);
    max-width: 28rem;
    margin: 0 auto;
    text-align: center;
  }
  .data-restore-screen__message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }
  .data-restore-screen__message h2 {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
  }
  .data-restore-screen__message p {
    color: var(--color-text-secondary);
  }
  .data-restore-screen__actions {
    width: 100%;
    margin-top: var(--space-8);
  }
`;
document.head.appendChild(style);
