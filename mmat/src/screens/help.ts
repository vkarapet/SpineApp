import { clearContainer, createElement } from '../utils/dom';
import { createHeader } from '../components/header';
import { APP_VERSION, INTENDED_USE_STATEMENT } from '../constants';
import { getProfile } from '../core/db';
import { getDeviceOS, getBrowserInfo } from '../utils/device';
import { router } from '../main';

export async function renderHelp(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const header = createHeader({
    title: 'Help',
    showBack: true,
    onBack: () => router.navigate('#/menu'),
  });

  const main = createElement('main', { className: 'help-screen' });
  main.setAttribute('role', 'main');

  // FAQ
  main.appendChild(createElement('h2', { textContent: 'Frequently Asked Questions' }));

  const faqs = [
    {
      q: 'Why aren\'t my taps counting?',
      a: 'Make sure you lift your finger completely between each tap. Using two fingers or holding your finger down will not count. Each tap must be a single finger touch.',
    },
    {
      q: 'My data isn\'t syncing. What should I do?',
      a: 'Check your internet connection. If you\'re online and data still isn\'t syncing, try the "Sync Now" button on the main screen. If the problem persists, contact the research team.',
    },
    {
      q: 'How do I install this app?',
      a: 'On Android: Tap the browser menu and select "Add to Home Screen." On iPhone/iPad: Tap the Share button (square with arrow), scroll down, and tap "Add to Home Screen."',
    },
    {
      q: 'How do I interpret my results?',
      a: 'Your results show tapping speed (taps per second), rhythm consistency, and accuracy. Higher speed and consistency scores generally indicate better motor function. Track your trends over time on the main screen graph.',
    },
  ];

  for (const faq of faqs) {
    const details = createElement('details', { className: 'help-screen__faq' });
    const summary = createElement('summary', { textContent: faq.q });
    const answer = createElement('p', { textContent: faq.a });
    details.appendChild(summary);
    details.appendChild(answer);
    main.appendChild(details);
  }

  // Test Instructions
  main.appendChild(createElement('h2', { textContent: 'Test Instructions' }));
  const instructions = createElement('div', { className: 'help-screen__section' });
  instructions.innerHTML = `
    <p><strong>Rapid Tapping Task</strong></p>
    <p>Tap the circle as fast as you can using one finger.</p>
    <ul>
      <li>Lift your finger completely between each tap</li>
      <li>Using two fingers or holding your finger down will not count</li>
      <li>The test lasts 15 seconds</li>
    </ul>
    <p><strong>The lift-off rule:</strong> To ensure accurate measurements, each tap must be a distinct
    touch-and-release action. If you press a second finger before lifting the first, that touch
    won't be counted toward your score (but is still recorded in the raw data).</p>
  `;
  main.appendChild(instructions);

  // Report a Problem
  main.appendChild(createElement('h2', { textContent: 'Report a Problem' }));
  const profile = await getProfile();
  const reportBtn = createElement('a', {
    className: 'help-screen__report-btn',
    textContent: 'Report a Problem',
  });
  const mailtoParams = new URLSearchParams({
    subject: 'MMAT - Problem Report',
    body: `\n\n---\nApp Version: ${APP_VERSION}\nDevice: ${getDeviceOS()}\nBrowser: ${getBrowserInfo()}\nLast Synced: ${profile?.last_synced_at ?? 'Never'}\n`,
  });
  reportBtn.setAttribute('href', `mailto:support@example.com?${mailtoParams.toString()}`);
  main.appendChild(reportBtn);

  // Intended Use
  main.appendChild(createElement('h2', { textContent: 'Intended Use' }));
  const intended = createElement('p', {
    className: 'help-screen__intended',
    textContent: INTENDED_USE_STATEMENT,
  });
  main.appendChild(intended);

  // Version
  const version = createElement('p', {
    className: 'help-screen__version',
    textContent: `Version ${APP_VERSION}`,
  });
  main.appendChild(version);

  container.appendChild(header);
  container.appendChild(main);
}

const style = document.createElement('style');
style.textContent = `
  .help-screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    padding-bottom: calc(var(--space-8) + var(--safe-area-bottom));
    max-width: 40rem;
    margin: 0 auto;
  }
  .help-screen h2 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    margin-top: var(--space-4);
  }
  .help-screen__faq {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .help-screen__faq + .help-screen__faq {
    margin-top: var(--space-2);
  }
  .help-screen__faq summary {
    padding: var(--space-4);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    min-height: var(--tap-target-min);
    display: flex;
    align-items: center;
  }
  .help-screen__faq p {
    padding: 0 var(--space-4) var(--space-4);
    color: var(--color-text-secondary);
    line-height: var(--line-height-relaxed);
  }
  .help-screen__section {
    line-height: var(--line-height-relaxed);
    color: var(--color-text-secondary);
  }
  .help-screen__section ul {
    padding-left: var(--space-6);
    list-style: disc;
    margin: var(--space-2) 0;
  }
  .help-screen__section li {
    margin-bottom: var(--space-1);
  }
  .help-screen__report-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--tap-target-min);
    padding: var(--space-3) var(--space-6);
    background: var(--color-primary);
    color: #fff;
    border-radius: var(--radius-md);
    font-weight: var(--font-weight-semibold);
    text-decoration: none;
  }
  .help-screen__intended {
    padding: var(--space-4);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    font-style: italic;
    color: var(--color-text-secondary);
    border-left: 4px solid var(--color-primary);
  }
  .help-screen__version {
    text-align: center;
    color: var(--color-text-disabled);
    font-size: var(--font-size-sm);
    margin-top: var(--space-8);
  }
`;
document.head.appendChild(style);
