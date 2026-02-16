import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { audioManager } from '../../utils/audio';
import { getProfile } from '../../core/db';
import { isScreenReaderActive } from '../../utils/device';
import { router } from '../../main';

export function renderGripInstructions(container: HTMLElement): void {
  clearContainer(container);

  if (isScreenReaderActive()) {
    renderScreenReaderGate(container);
    return;
  }

  const wrapper = createElement('main', { className: 'tapping-instructions' });
  wrapper.setAttribute('role', 'main');

  const title = createElement('h1', { textContent: 'Grip & Release Test' });

  const body = createElement('div', { className: 'tapping-instructions__body' });
  body.innerHTML = `
    <p>Grip the phone with 4 fingers touching the screen, then release. Repeat as fast as you can.</p>
    <div class="tapping-instructions__important">
      <strong>Important:</strong>
      <ul>
        <li>Place the phone in your palm, screen facing up</li>
        <li>Grip the phone with 4 fingers touching the screen, then release all fingers</li>
        <li>A grip only counts when 4+ fingers touch at the same time</li>
        <li>The test lasts 10 seconds</li>
      </ul>
    </div>
  `;

  // Hand position diagram
  const diagram = createElement('div', { className: 'grip-instructions__diagram' });
  diagram.innerHTML = `
    <svg viewBox="0 0 200 260" width="200" height="260" aria-label="Hand position diagram showing phone in palm with 4 fingers curling up to touch screen">
      <!-- Phone outline -->
      <rect x="40" y="10" width="120" height="220" rx="16" ry="16"
            fill="none" stroke="var(--color-text-secondary)" stroke-width="2"/>
      <rect x="48" y="30" width="104" height="180" rx="4" ry="4"
            fill="var(--color-bg-secondary)" stroke="var(--color-border)" stroke-width="1"/>
      <!-- Screen label -->
      <text x="100" y="120" text-anchor="middle" font-size="11" fill="var(--color-text-secondary)">Screen</text>
      <!-- 4 finger contact points -->
      <circle cx="68" cy="160" r="8" fill="var(--color-primary)" opacity="0.8"/>
      <circle cx="88" cy="150" r="8" fill="var(--color-primary)" opacity="0.8"/>
      <circle cx="112" cy="150" r="8" fill="var(--color-primary)" opacity="0.8"/>
      <circle cx="132" cy="160" r="8" fill="var(--color-primary)" opacity="0.8"/>
      <!-- Finger labels -->
      <text x="100" y="185" text-anchor="middle" font-size="10" fill="var(--color-text-secondary)">4 fingers</text>
      <!-- Hand arc below phone -->
      <path d="M 30 240 Q 100 280 170 240" fill="none" stroke="var(--color-text-secondary)"
            stroke-width="2" stroke-dasharray="4 4"/>
      <text x="100" y="255" text-anchor="middle" font-size="10" fill="var(--color-text-secondary)">Palm (underneath)</text>
    </svg>
  `;

  // Show Me How animation
  const demoBtn = createButton({
    text: 'Show Me How',
    variant: 'secondary',
    fullWidth: true,
    onClick: () => showDemo(wrapper),
  });

  const readyBtn = createButton({
    text: "I'm Ready",
    variant: 'primary',
    fullWidth: true,
    onClick: async () => {
      audioManager.initOnGesture();
      const profile = await getProfile();
      const audioEnabled = profile?.preferences.audio_enabled ?? true;
      audioManager.setEnabled(audioEnabled);
      await audioManager.preloadAll();

      const needsPractice = profile && !profile.practice_completed;
      if (needsPractice) {
        router.navigate('#/assessment/grip_v1/practice');
      } else {
        router.navigate('#/assessment/grip_v1/countdown');
      }
    },
  });

  const actions = createElement('div', { className: 'tapping-instructions__actions' });
  actions.appendChild(demoBtn);
  actions.appendChild(readyBtn);

  const cancelBtn = createButton({
    text: 'Cancel',
    variant: 'text',
    onClick: () => router.navigate('#/menu'),
  });

  wrapper.appendChild(title);
  wrapper.appendChild(body);
  wrapper.appendChild(diagram);
  wrapper.appendChild(actions);
  wrapper.appendChild(cancelBtn);
  container.appendChild(wrapper);
}

function showDemo(wrapper: HTMLElement): void {
  const existing = wrapper.querySelector('.grip-instructions__demo');
  if (existing) {
    existing.remove();
    return;
  }

  const demo = createElement('div', { className: 'grip-instructions__demo' });
  demo.innerHTML = `
    <div class="grip-instructions__demo-dots">
      <div class="grip-instructions__demo-dot grip-instructions__demo-dot--1"></div>
      <div class="grip-instructions__demo-dot grip-instructions__demo-dot--2"></div>
      <div class="grip-instructions__demo-dot grip-instructions__demo-dot--3"></div>
      <div class="grip-instructions__demo-dot grip-instructions__demo-dot--4"></div>
    </div>
    <p>4 fingers touch the screen, then all release together</p>
  `;
  wrapper.insertBefore(demo, wrapper.querySelector('.tapping-instructions__actions'));
}

function renderScreenReaderGate(container: HTMLElement): void {
  const wrapper = createElement('main', { className: 'tapping-instructions' });
  wrapper.setAttribute('role', 'main');

  const msg = createElement('div', { className: 'tapping-instructions__sr-gate' });
  msg.innerHTML = `
    <h1>Accessibility Notice</h1>
    <p>This assessment requires gripping the phone with multiple fingers and is not compatible
    with screen readers. All other parts of the app — including your results, history,
    and settings — are fully accessible.</p>
  `;

  const backBtn = createButton({
    text: 'Return to Home',
    variant: 'primary',
    fullWidth: true,
    onClick: () => router.navigate('#/menu'),
  });

  wrapper.appendChild(msg);
  wrapper.appendChild(backBtn);
  container.appendChild(wrapper);
}

const style = document.createElement('style');
style.textContent = `
  .grip-instructions__diagram {
    display: flex;
    justify-content: center;
    padding: var(--space-2) 0;
  }
  .grip-instructions__demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-6);
  }
  .grip-instructions__demo-dots {
    display: flex;
    gap: var(--space-4);
  }
  .grip-instructions__demo-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-primary);
    animation: grip-demo 2s infinite;
  }
  .grip-instructions__demo-dot--1 { animation-delay: 0s; }
  .grip-instructions__demo-dot--2 { animation-delay: 0.1s; }
  .grip-instructions__demo-dot--3 { animation-delay: 0.2s; }
  .grip-instructions__demo-dot--4 { animation-delay: 0.3s; }
  @keyframes grip-demo {
    0%, 100% { opacity: 0; transform: scale(0.5); background: var(--color-primary); }
    20% { opacity: 1; transform: scale(1); background: var(--color-primary); }
    40% { opacity: 1; transform: scale(1); background: var(--color-success); }
    60% { opacity: 0; transform: scale(0.5); }
  }
  .grip-instructions__demo p {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    text-align: center;
  }
`;
document.head.appendChild(style);
