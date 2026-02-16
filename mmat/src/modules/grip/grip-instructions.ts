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

  const wrapper = createElement('main', { className: 'assessment-instructions' });
  wrapper.setAttribute('role', 'main');

  const title = createElement('h1', { textContent: 'Grip & Release Test' });

  const body = createElement('div', { className: 'assessment-instructions__body' });
  body.innerHTML = `
    <p>Grip the phone with 3+ fingers, release fully, and repeat as fast as you can for 10 seconds.</p>
    <ul class="grip-instructions__steps">
      <li>Rest the phone in your palm, screen up, hand on a flat surface</li>
      <li>Curl your fingers onto the screen to grip</li>
      <li>Open your fingers completely before each new grip</li>
    </ul>
  `;

  // Animated diagram — alternates between open and grip images every 1s
  const diagram = createElement('div', { className: 'grip-instructions__diagram' });
  diagram.setAttribute('aria-label', 'Animation showing a hand gripping and releasing a phone');
  diagram.innerHTML = `
    <div class="grip-instructions__img-container">
      <img class="grip-instructions__img grip-instructions__img--open"
           src="/images/grip-open.png"
           alt="Hand open with fingers extended above phone"
           width="256" height="256" />
      <img class="grip-instructions__img grip-instructions__img--grip"
           src="/images/grip-closed.png"
           alt="Hand gripping phone with fingers curled onto screen"
           width="256" height="256" />
    </div>
  `;

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
  .grip-instructions__steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    counter-reset: step;
  }
  .grip-instructions__steps li {
    position: relative;
    padding-left: var(--space-6);
    font-size: var(--font-size-base);
    line-height: var(--line-height-relaxed);
  }
  .grip-instructions__steps li::before {
    content: counter(step);
    counter-increment: step;
    position: absolute;
    left: 0;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--color-primary);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    top: 2px;
  }
  .grip-instructions__diagram {
    display: flex;
    justify-content: center;
    padding: var(--space-2) 0;
  }
  .grip-instructions__img-container {
    position: relative;
    width: 256px;
    height: 256px;
  }
  .grip-instructions__img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .grip-instructions__img--open {
    animation: grip-toggle 2s step-end infinite;
  }
  .grip-instructions__img--grip {
    animation: grip-toggle 2s step-end infinite;
    animation-delay: -1s;
  }
  @keyframes grip-toggle {
    0%, 50% { opacity: 1; }
    50.01%, 100% { opacity: 0; }
  }
`;
document.head.appendChild(style);
