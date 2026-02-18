import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { audioManager } from '../../utils/audio';
import { getProfile } from '../../core/db';
import { isScreenReaderActive } from '../../utils/device';
import { router } from '../../main';

export function renderTappingInstructions(container: HTMLElement): void {
  clearContainer(container);

  // Screen reader gate
  if (isScreenReaderActive()) {
    renderScreenReaderGate(container);
    return;
  }

  const wrapper = createElement('main', { className: 'assessment-instructions' });
  wrapper.setAttribute('role', 'main');

  const title = createElement('h1', { textContent: 'Rapid Tapping Task' });

  const body = createElement('div', { className: 'assessment-instructions__body' });
  body.innerHTML = `
    <p>Tap the circle as fast as you can using one finger.</p>
    <div class="assessment-instructions__important">
      <strong>Important:</strong>
      <ul>
        <li>Lift your finger completely between each tap</li>
        <li>Using two fingers or holding your finger down will not count</li>
        <li>The test lasts 10 seconds</li>
      </ul>
    </div>
  `;

  // Demo animation
  const demo = createElement('div', { className: 'assessment-instructions__demo' });
  demo.innerHTML = `
    <div class="assessment-instructions__demo-circle">
      <div class="assessment-instructions__demo-finger"></div>
    </div>
    <p>Tap with one finger, lift completely, then tap again</p>
  `;

  const practiceBtn = createButton({
    text: 'Practice',
    variant: 'secondary',
    fullWidth: true,
    onClick: async () => {
      audioManager.initOnGesture();
      const profile = await getProfile();
      const audioEnabled = profile?.preferences.audio_enabled ?? true;
      audioManager.setEnabled(audioEnabled);
      await audioManager.preloadAll();
      router.navigate('#/assessment/tapping_v1/practice');
    },
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
      router.navigate('#/assessment/tapping_v1/countdown');
    },
  });

  const actions = createElement('div', { className: 'assessment-instructions__actions' });
  actions.appendChild(practiceBtn);
  actions.appendChild(readyBtn);

  const cancelBtn = createButton({
    text: 'Cancel',
    variant: 'text',
    onClick: () => router.navigate('#/menu'),
  });

  wrapper.appendChild(title);
  wrapper.appendChild(body);
  wrapper.appendChild(demo);
  wrapper.appendChild(actions);
  wrapper.appendChild(cancelBtn);
  container.appendChild(wrapper);
}

function renderScreenReaderGate(container: HTMLElement): void {
  const wrapper = createElement('main', { className: 'assessment-instructions' });
  wrapper.setAttribute('role', 'main');

  const msg = createElement('div', { className: 'assessment-instructions__sr-gate' });
  msg.innerHTML = `
    <h1>Accessibility Notice</h1>
    <p>This assessment requires tapping the screen with your finger and is not compatible
    with screen readers. All other parts of the app \u2014 including your results, history,
    and settings \u2014 are fully accessible.</p>
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
  .assessment-instructions__demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-6);
  }
  .assessment-instructions__demo-circle {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: var(--color-primary);
    position: relative;
  }
  .assessment-instructions__demo-finger {
    position: absolute;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(0,0,0,0.3);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: tap-demo 1s infinite;
  }
  @keyframes tap-demo {
    0%, 100% { transform: translate(-50%, -150%); opacity: 0; }
    30%, 60% { transform: translate(-50%, -50%); opacity: 1; }
  }
`;
document.head.appendChild(style);
