import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { audioManager } from '../../utils/audio';
import { vibrate, supportsVibration } from '../../utils/device';
import { getProfile } from '../../core/db';
import { router } from '../../main';

export function renderTappingCountdown(container: HTMLElement): void {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'tapping-countdown' });
  wrapper.setAttribute('role', 'main');

  // Cancel button
  const cancelBtn = createButton({
    text: '\u00D7 Cancel',
    variant: 'text',
    onClick: () => {
      cancelled = true;
      router.navigate('#/assessment/tapping_v1/instructions');
    },
  });
  cancelBtn.className = 'tapping-countdown__cancel';

  const countdownDisplay = createElement('div', {
    className: 'tapping-countdown__number',
    'aria-live': 'assertive',
    'aria-atomic': 'true',
  });

  wrapper.appendChild(cancelBtn);
  wrapper.appendChild(countdownDisplay);
  container.appendChild(wrapper);

  let cancelled = false;
  let count = 3;

  const showCount = async () => {
    if (cancelled) return;

    countdownDisplay.textContent = String(count);

    const profile = await getProfile();
    const audioEnabled = profile?.preferences.audio_enabled ?? true;
    const hapticEnabled = profile?.preferences.haptic_enabled ?? true;

    if (audioEnabled) {
      audioManager.play('beep');
    }
    if (hapticEnabled && supportsVibration()) {
      vibrate(30);
    }

    count--;

    if (count >= 0) {
      setTimeout(showCount, 1000);
    } else {
      if (!cancelled) {
        router.navigate('#/assessment/tapping_v1/active', true);
      }
    }
  };

  setTimeout(showCount, 300);
}

const style = document.createElement('style');
style.textContent = `
  .tapping-countdown {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--color-bg);
    position: relative;
  }
  .tapping-countdown__cancel {
    position: absolute;
    top: calc(var(--space-4) + var(--safe-area-top));
    right: var(--space-4);
    z-index: 10;
  }
  .tapping-countdown__number {
    font-size: var(--font-size-4xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-primary);
    animation: countdown-pulse 1s infinite;
  }
  @keyframes countdown-pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 0.8; }
  }
`;
document.head.appendChild(style);
