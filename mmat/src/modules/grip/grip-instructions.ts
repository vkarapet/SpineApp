import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { audioManager } from '../../utils/audio';
import { getProfile } from '../../core/db';
import { isScreenReaderActive, getDeviceOS } from '../../utils/device';
import { router } from '../../main';

export function renderGripInstructions(container: HTMLElement): void {
  clearContainer(container);

  if (isScreenReaderActive()) {
    renderScreenReaderGate(container);
    return;
  }

  const wrapper = createElement('main', { className: 'assessment-instructions' });
  wrapper.setAttribute('role', 'main');

  const title = createElement('h1', { textContent: 'Grip & Release Test' });

  const body = createElement('div', { className: 'assessment-instructions__body' });
  body.innerHTML = `
    <p>Hold the phone sideways in your palm and grip with your fingers, then release. Repeat as fast as you can.</p>
    <div class="assessment-instructions__important">
      <strong>Important:</strong>
      <ul>
        <li>Rest the phone across your palm, screen facing up</li>
        <li>Curl your fingers onto the screen, then release all at once</li>
        <li>A grip counts when at least 3 fingers touch the screen at the same time</li>
        <li>The test lasts 10 seconds</li>
      </ul>
    </div>
    <div class="assessment-instructions__setup">
      <strong>Before you start:</strong>
      <p>Lock your phone to this app to prevent system gestures (like screenshot or copy/paste) from interrupting the test.</p>
      ${getDeviceOS() === 'Android' ? `
      <ol>
        <li>Go to <strong>Settings &gt; Security &gt; App pinning</strong> and turn it on</li>
        <li>Open <strong>Recent Apps</strong>, tap the app icon above the preview, and select <strong>Pin</strong></li>
      </ol>
      <p>To unpin: swipe up and hold, or press Back + Home together.</p>
      <p>Also disable any multi-finger gestures (e.g. three-finger screenshot) in <strong>Settings &gt; Advanced features</strong> or your manufacturer's gesture settings.</p>
      ` : `
      <ol>
        <li>Go to <strong>Settings &gt; Accessibility &gt; Guided Access</strong> and turn it on</li>
        <li>Return here, then <strong>triple-click the side button</strong> to activate</li>
        <li>Tap <strong>Start</strong> in the top-right corner</li>
      </ol>
      <p>Triple-click again when finished to exit Guided Access.</p>
      `}
    </div>
  `;

  // Hand position diagram — phone sideways in palm, fingers curling onto screen
  const diagram = createElement('div', { className: 'grip-instructions__diagram' });
  diagram.innerHTML = `
    <svg viewBox="0 0 260 220" width="260" height="220" aria-label="Diagram showing a hand holding the phone sideways in the palm with 4 fingers curling onto the screen">
      <!-- Palm (back of hand, viewed from above) -->
      <path d="M 48 180 C 30 170 18 130 20 100 C 22 75 30 60 45 52
               L 50 40 C 52 28 58 20 65 22 C 72 24 72 36 70 48 L 68 56
               L 80 26 C 82 14 90 6 97 10 C 104 14 102 28 98 42 L 92 60
               L 108 22 C 112 10 120 4 127 8 C 134 13 131 28 126 44 L 118 64
               L 132 32 C 136 20 144 16 150 22 C 156 28 152 42 146 56 L 130 86
               C 148 76 158 78 160 90 C 162 102 152 112 140 116
               L 140 130 C 138 160 120 178 90 184
               Z"
            fill="var(--color-bg-tertiary)" stroke="var(--color-text-secondary)" stroke-width="1.5"/>
      <!-- Knuckle creases -->
      <path d="M 56 68 Q 80 58 118 68" fill="none" stroke="var(--color-border)" stroke-width="1" opacity="0.6"/>
      <path d="M 50 90 Q 85 78 130 88" fill="none" stroke="var(--color-border)" stroke-width="1" opacity="0.6"/>

      <!-- Phone (sideways in palm — long axis across fingers) -->
      <rect x="55" y="92" width="160" height="82" rx="10" ry="10"
            fill="var(--color-bg)" stroke="var(--color-text-secondary)" stroke-width="2"/>
      <!-- Screen -->
      <rect x="68" y="98" width="134" height="70" rx="3" ry="3"
            fill="var(--color-bg-secondary)" stroke="var(--color-border)" stroke-width="1"/>
      <text x="135" y="137" text-anchor="middle" font-size="10" fill="var(--color-text-secondary)">Screen</text>

      <!-- 4 finger contact points on screen -->
      <circle cx="90" cy="120" r="7" fill="var(--color-primary)" opacity="0.8"/>
      <circle cx="115" cy="116" r="7" fill="var(--color-primary)" opacity="0.8"/>
      <circle cx="140" cy="116" r="7" fill="var(--color-primary)" opacity="0.8"/>
      <circle cx="165" cy="120" r="7" fill="var(--color-primary)" opacity="0.8"/>

      <!-- Finger arcs curling over the top edge of the phone -->
      <path d="M 90 92 C 88 82 86 76 82 72" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M 115 92 C 113 80 110 72 106 66" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M 140 92 C 138 80 134 72 128 68" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M 165 92 C 160 82 155 76 148 72" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.5" stroke-linecap="round"/>

      <!-- Thumb on the side -->
      <path d="M 48 130 C 38 125 34 118 38 110 C 42 102 50 100 55 104"
            fill="var(--color-bg-tertiary)" stroke="var(--color-text-secondary)" stroke-width="1.5"/>

      <!-- Label -->
      <text x="135" y="152" text-anchor="middle" font-size="9" fill="var(--color-primary)" font-weight="600">3+ fingers</text>
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

  const actions = createElement('div', { className: 'assessment-instructions__actions' });
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
    <p>Fingers touch the screen, then all release together</p>
  `;
  wrapper.insertBefore(demo, wrapper.querySelector('.assessment-instructions__actions'));
}

function renderScreenReaderGate(container: HTMLElement): void {
  const wrapper = createElement('main', { className: 'assessment-instructions' });
  wrapper.setAttribute('role', 'main');

  const msg = createElement('div', { className: 'assessment-instructions__sr-gate' });
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
  .assessment-instructions__setup {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
  }
  .assessment-instructions__setup strong {
    color: var(--color-text);
  }
  .assessment-instructions__setup ol {
    padding-left: var(--space-5);
    margin: var(--space-2) 0;
  }
  .assessment-instructions__setup ol li {
    margin-bottom: var(--space-1);
  }
  .assessment-instructions__setup p {
    margin: var(--space-2) 0;
  }
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
