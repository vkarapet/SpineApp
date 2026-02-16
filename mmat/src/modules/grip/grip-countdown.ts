import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { audioManager } from '../../utils/audio';
import { vibrate, supportsVibration } from '../../utils/device';
import { getProfile } from '../../core/db';
import { router } from '../../main';

export function renderGripCountdown(container: HTMLElement): void {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'tapping-countdown' });
  wrapper.setAttribute('role', 'main');

  const cancelBtn = createButton({
    text: '\u00d7 Cancel',
    variant: 'text',
    onClick: () => {
      cancelled = true;
      router.navigate('#/assessment/grip_v1/instructions');
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
        router.navigate('#/assessment/grip_v1/active', true);
      }
    }
  };

  setTimeout(showCount, 300);
}
