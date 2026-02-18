import { clearContainer, createElement } from '../utils/dom';
import { createButton } from '../components/button';
import { INTENDED_USE_STATEMENT, CONSENT_VERSION } from '../constants';
import { router } from '../main';

export function renderConsent(container: HTMLElement): void {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'consent-screen' });
  wrapper.setAttribute('role', 'main');

  const header = createElement('header', { className: 'consent-screen__header' });
  header.appendChild(
    createElement('h1', {
      className: 'consent-screen__title',
      textContent: 'Consent & Privacy',
    }),
  );
  header.appendChild(
    createElement('p', {
      className: 'consent-screen__version',
      textContent: `Version ${CONSENT_VERSION}`,
    }),
  );

  const content = createElement('section', { className: 'consent-screen__content' });
  content.innerHTML = `
    <h2>Research Participation Consent</h2>

    <h3>Intended Use</h3>
    <p class="consent-screen__highlight">${INTENDED_USE_STATEMENT}</p>

    <h3>Purpose</h3>
    <p>This application is designed to collect longitudinal motor assessment data
    for research purposes. Your participation helps researchers understand patterns of motor
    function over time.</p>

    <h3>Procedures</h3>
    <p>You will be asked to complete brief motor assessments at regular intervals. These include
    a rapid tapping task, a grip &amp; release test, and a timed up &amp; go walking test.
    Each assessment takes under a minute. Your results are stored on your device and
    synchronized with a research database when online.</p>

    <h3>Data Handling</h3>
    <p>Your data is identified by a pre-assigned participant ID provided by the research team.
    No personal information (such as email or date of birth) is collected. An optional display
    name is stored locally on your device only and is never transmitted.</p>

    <h3>Risks &amp; Benefits</h3>
    <p>There are no known physical risks. The primary risk is potential loss of privacy, which
    is mitigated by the use of pseudonymous participant IDs. You may not receive direct
    benefit, but your participation contributes to research understanding.</p>

    <h3>Right to Withdraw</h3>
    <p>You may withdraw at any time by using the "Delete Device Data" option in Settings.
    This will permanently remove all data from your device. To request deletion of previously
    synced data from the research database, contact the research team.</p>

    <h3>Contact</h3>
    <p>For questions about this research, please contact the research team using the
    information provided in the app's Help section.</p>
  `;

  const checkboxContainer = createElement('div', { className: 'consent-screen__checkbox' });
  const checkbox = createElement('input', { id: 'consent-check' });
  checkbox.type = 'checkbox';
  checkbox.setAttribute('aria-label', 'I have read and agree to the terms');

  const checkboxLabel = createElement('label', {
    textContent: 'I have read and agree to the terms',
  });
  checkboxLabel.setAttribute('for', 'consent-check');

  checkboxContainer.appendChild(checkbox);
  checkboxContainer.appendChild(checkboxLabel);

  const agreeBtn = createButton({
    text: 'Continue',
    variant: 'primary',
    fullWidth: true,
    disabled: true,
    onClick: () => {
      router.navigate('#/profile-setup');
    },
  });

  const declineBtn = createButton({
    text: 'Decline',
    variant: 'text',
    fullWidth: true,
    onClick: () => {
      showDeclineMessage(wrapper);
    },
  });

  checkbox.addEventListener('change', () => {
    agreeBtn.disabled = !checkbox.checked;
    agreeBtn.classList.toggle('btn--disabled', !checkbox.checked);
  });

  const actions = createElement('div', { className: 'consent-screen__actions' });
  actions.appendChild(agreeBtn);
  actions.appendChild(declineBtn);

  wrapper.appendChild(header);
  wrapper.appendChild(content);
  wrapper.appendChild(checkboxContainer);
  wrapper.appendChild(actions);
  container.appendChild(wrapper);
}

function showDeclineMessage(wrapper: HTMLElement): void {
  const existing = wrapper.querySelector('.consent-screen__decline');
  if (existing) return;

  const msg = createElement('div', { className: 'consent-screen__decline' });
  msg.setAttribute('role', 'alert');
  msg.innerHTML = `
    <p>You cannot use this app without consenting to the terms. You may close the app.</p>
  `;

  const reviewBtn = createButton({
    text: 'Review Terms Again',
    variant: 'secondary',
    onClick: () => msg.remove(),
  });
  msg.appendChild(reviewBtn);

  wrapper.appendChild(msg);
}

// Inject consent styles
const style = document.createElement('style');
style.textContent = `
  .consent-screen {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    padding: var(--space-6) var(--space-4) calc(var(--space-8) + var(--safe-area-bottom));
    max-width: 40rem;
    margin: 0 auto;
  }
  .consent-screen__header {
    text-align: center;
    margin-bottom: var(--space-6);
  }
  .consent-screen__title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
  }
  .consent-screen__version {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-top: var(--space-1);
  }
  .consent-screen__content {
    flex: 1;
    overflow-y: auto;
    padding-bottom: var(--space-6);
    line-height: var(--line-height-relaxed);
  }
  .consent-screen__content h2 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--space-4);
  }
  .consent-screen__content h3 {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    margin-top: var(--space-6);
    margin-bottom: var(--space-2);
  }
  .consent-screen__content p {
    color: var(--color-text-secondary);
    margin-bottom: var(--space-3);
  }
  .consent-screen__highlight {
    background: var(--color-bg-secondary);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    border-left: 4px solid var(--color-primary);
    font-style: italic;
  }
  .consent-screen__checkbox {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) 0;
    border-top: 1px solid var(--color-border);
  }
  .consent-screen__checkbox input[type="checkbox"] {
    width: var(--tap-target-min);
    height: var(--tap-target-min);
    min-width: var(--tap-target-min);
    cursor: pointer;
    accent-color: var(--color-primary);
  }
  .consent-screen__checkbox label {
    font-weight: var(--font-weight-medium);
    cursor: pointer;
  }
  .consent-screen__actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-4);
  }
  .consent-screen__decline {
    margin-top: var(--space-4);
    padding: var(--space-4);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    text-align: center;
  }
  .consent-screen__decline p {
    margin-bottom: var(--space-4);
    color: var(--color-text-secondary);
  }
`;
document.head.appendChild(style);
