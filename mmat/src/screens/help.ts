import { clearContainer, createElement } from '../utils/dom';
import { createHeader } from '../components/header';
import { createButton } from '../components/button';
import { APP_VERSION, INTENDED_USE_STATEMENT } from '../constants';
import { getProfile } from '../core/db';
import { getDeviceOS, getBrowserInfo, isStandalone } from '../utils/device';
import { showInstallPrompt } from '../services/install-service';
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

  // Install
  main.appendChild(createElement('h2', { textContent: 'Install' }));

  if (isStandalone()) {
    main.appendChild(
      createButton({
        text: 'App Installed',
        variant: 'success',
        fullWidth: true,
        disabled: true,
        onClick: () => {},
      }),
    );
  } else {
    main.appendChild(
      createButton({
        text: 'Install this App',
        variant: 'primary',
        fullWidth: true,
        onClick: () => showInstallPrompt(),
      }),
    );
  }

  // Uninstall
  main.appendChild(createElement('h2', { textContent: 'Uninstall' }));
  const uninstallInfo = createElement('div', { className: 'help-screen__section' });
  uninstallInfo.innerHTML = `
    <p>To remove MMAT, simply remove it from your home screen.</p>
    <p><strong>Do not select "Uninstall" if prompted — this will remove your web browser, not just MMAT.</strong></p>
  `;
  main.appendChild(uninstallInfo);

  // FAQ
  main.appendChild(createElement('h2', { textContent: 'Frequently Asked Questions' }));

  const faqs = [
    {
      q: 'Why aren\'t my taps counting?',
      a: 'Make sure you lift your finger completely between each tap. Using two fingers or holding your finger down will not count. Each tap must be a single finger touch.',
    },
    {
      q: 'Why aren\'t my grips counting?',
      a: 'You need to place 3 or more fingers on the screen at once to register a grip. Open your fingers completely between each grip so the phone detects a full release before the next one.',
    },
    {
      q: 'The TUG test isn\'t detecting my movements. What should I do?',
      a: 'Make sure the phone is placed securely in your front trouser pocket with the screen on. Do not turn off the screen during the test. Run the Sensor Calibration from the instructions page to verify your sensors are working.',
    },
    {
      q: 'My data isn\'t syncing. What should I do?',
      a: 'Check your internet connection. If you\'re online and data still isn\'t syncing, try the "Sync Now" button on the main screen. If the problem persists, contact the research team.',
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
    <p><strong>Rapid Tapping Task</strong> (10 seconds)</p>
    <p>Tap the circle as fast as you can using one finger.</p>
    <ul>
      <li>Lift your finger completely between each tap</li>
      <li>Using two fingers or holding your finger down will not count</li>
    </ul>

    <p><strong>Grip &amp; Release Test</strong> (10 seconds)</p>
    <p>Grip the phone with 3+ fingers, release fully, and repeat as fast as you can.</p>
    <ul>
      <li>Rest the phone in your palm, screen up, hand on a flat surface</li>
      <li>Curl your fingers onto the screen to grip</li>
      <li>Open your fingers completely before each new grip</li>
    </ul>

    <p><strong>Timed Up &amp; Go</strong></p>
    <p>A sensor-based walking test with the phone in your pocket.</p>
    <ul>
      <li>Do not turn off the screen during the test</li>
      <li>Place the phone in your front trouser pocket</li>
      <li>Sit in a chair, sit still, and the test starts automatically</li>
      <li>Stand up, walk 3 meters, turn around, walk back, and sit down</li>
      <li>Remain still after sitting &mdash; an end tone marks the end of the test</li>
    </ul>
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

  // About
  main.appendChild(createElement('h2', { textContent: 'About' }));
  const aboutSection = createElement('div', { className: 'help-screen__about' });
  aboutSection.innerHTML = `
    <p><strong>MMAT</strong> v${APP_VERSION}</p>
    <p class="help-screen__intended">${INTENDED_USE_STATEMENT}</p>
    <p class="help-screen__contact">For support, contact the research team.</p>
  `;
  main.appendChild(aboutSection);

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
  .help-screen__about {
    padding: var(--space-4);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }
  .help-screen__about p {
    margin-bottom: var(--space-2);
  }
  .help-screen__intended {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-style: italic;
  }
  .help-screen__contact {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
`;
document.head.appendChild(style);
