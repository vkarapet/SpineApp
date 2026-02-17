import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { TUG_STILLNESS_ACCEL_TOLERANCE, TUG_STILLNESS_DURATION_MS } from '../../constants';
import { router } from '../../main';

/**
 * Stillness detection screen — replaces the audible countdown.
 * Instructs the participant to put the phone in their pocket and sit still.
 * After 3 seconds of no significant movement, navigates to the active screen.
 */
export function renderTugCountdown(container: HTMLElement): void {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'assessment-countdown' });
  wrapper.setAttribute('role', 'main');

  const cancelBtn = createButton({
    text: '\u00d7 Cancel',
    variant: 'text',
    onClick: () => {
      cancelled = true;
      cleanup();
      router.navigate('#/assessment/tug_v1/instructions');
    },
  });
  cancelBtn.className = 'assessment-countdown__cancel';

  const prompt = createElement('div', {
    className: 'tug-countdown__prompt',
    'aria-live': 'assertive',
  });
  prompt.innerHTML = `
    <div class="tug-countdown__icon">&#128241;</div>
    <h2>Put phone in your pocket</h2>
    <p>Then sit still in the chair.</p>
    <p class="tug-countdown__sub">The test will start automatically<br>when you are still for 3 seconds.</p>
  `;

  const statusDisplay = createElement('div', {
    className: 'tug-countdown__status',
    textContent: 'Waiting for sensor data...',
  });

  wrapper.appendChild(cancelBtn);
  wrapper.appendChild(prompt);
  wrapper.appendChild(statusDisplay);
  container.appendChild(wrapper);

  // Acquire Wake Lock
  let wakeLock: WakeLockSentinel | null = null;
  if ('wakeLock' in navigator) {
    (navigator as Navigator).wakeLock.request('screen').then((lock) => {
      wakeLock = lock;
    }).catch(() => { /* Wake Lock not available */ });
  }

  let cancelled = false;
  let stillSince = 0;
  let gravityMag = 0;

  const motionHandler = (event: DeviceMotionEvent) => {
    if (cancelled) return;

    const ax = event.accelerationIncludingGravity?.x ?? 0;
    const ay = event.accelerationIncludingGravity?.y ?? 0;
    const az = event.accelerationIncludingGravity?.z ?? 0;
    const mag = Math.sqrt(ax * ax + ay * ay + az * az);

    // Update gravity estimate on first sample
    if (gravityMag === 0) gravityMag = mag;
    // Smooth gravity magnitude
    gravityMag = 0.1 * mag + 0.9 * gravityMag;

    const deviation = Math.abs(mag - gravityMag);
    const isStill = deviation < TUG_STILLNESS_ACCEL_TOLERANCE;

    const now = performance.now();

    if (isStill) {
      if (stillSince === 0) stillSince = now;
      const elapsed = now - stillSince;
      const remaining = Math.max(0, TUG_STILLNESS_DURATION_MS - elapsed);
      const remainingSec = Math.ceil(remaining / 1000);

      if (remaining <= 0) {
        // Stillness achieved — start the test
        cancelled = true;
        cleanup();

        // Pass wake lock to active screen
        if (wakeLock) {
          (window as unknown as Record<string, unknown>).__tugWakeLock = wakeLock;
          wakeLock = null;
        }
        router.navigate('#/assessment/tug_v1/active', true);
        return;
      }

      statusDisplay.textContent = `Hold still... ${remainingSec}`;
      statusDisplay.classList.add('tug-countdown__status--active');
    } else {
      stillSince = 0;
      statusDisplay.textContent = 'Waiting for stillness...';
      statusDisplay.classList.remove('tug-countdown__status--active');
    }
  };

  function cleanup(): void {
    window.removeEventListener('devicemotion', motionHandler);
    if (!cancelled) {
      wakeLock?.release().catch(() => {});
    }
  }

  window.addEventListener('devicemotion', motionHandler);

  // Timeout: if no motion events after 5s, show fallback
  setTimeout(() => {
    if (!cancelled && gravityMag === 0) {
      statusDisplay.textContent = 'No sensor data. Make sure sensors are enabled.';
    }
  }, 5000);
}

const style = document.createElement('style');
style.textContent = `
  .tug-countdown__prompt {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .tug-countdown__prompt h2 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
  }
  .tug-countdown__prompt p {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    line-height: var(--line-height-relaxed);
  }
  .tug-countdown__sub {
    font-size: var(--font-size-sm) !important;
    opacity: 0.7;
  }
  .tug-countdown__icon {
    font-size: 3rem;
    margin-bottom: var(--space-2);
  }
  .tug-countdown__status {
    margin-top: var(--space-6);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
    text-align: center;
    transition: color 0.2s;
  }
  .tug-countdown__status--active {
    color: var(--color-primary);
  }
`;
document.head.appendChild(style);
