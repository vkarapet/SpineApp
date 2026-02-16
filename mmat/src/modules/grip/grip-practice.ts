import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { vibrate, supportsVibration } from '../../utils/device';
import { getProfile, saveProfile } from '../../core/db';
import { GRIP_PRACTICE_DURATION_MS, GRIP_MIN_FINGERS } from '../../constants';
import { router } from '../../main';

export function renderGripPractice(container: HTMLElement): void {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'tapping-practice' });
  wrapper.setAttribute('role', 'main');

  const intro = createElement('div', { className: 'tapping-practice__intro' });
  intro.innerHTML = `
    <h1>Practice Round</h1>
    <p>Let's do a quick 5-second practice first. This won't be saved.</p>
    <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
      Place the phone in your palm and grip with ${GRIP_MIN_FINGERS}+ fingers, then release.
    </p>
  `;

  const startBtn = createButton({
    text: 'Start Practice',
    variant: 'primary',
    fullWidth: true,
    onClick: () => runPractice(wrapper),
  });

  intro.appendChild(startBtn);
  wrapper.appendChild(intro);
  container.appendChild(wrapper);
}

function runPractice(wrapper: HTMLElement): void {
  clearContainer(wrapper);

  const practiceArea = createElement('div', { className: 'grip-practice__area' });

  // Counter
  const counter = createElement('div', {
    className: 'tapping-practice__counter',
    textContent: '0',
  });

  // Feedback text
  const feedback = createElement('div', {
    className: 'grip-practice__feedback',
    'aria-live': 'polite',
  });

  // Progress bar
  const progressBar = createElement('div', { className: 'tapping-practice__progress' });
  const progressFill = createElement('div', { className: 'tapping-practice__progress-fill' });
  progressBar.appendChild(progressFill);

  // Finger indicators container
  const indicatorContainer = createElement('div', { className: 'grip-practice__indicators' });

  // Finger count display
  const fingerCount = createElement('div', {
    className: 'grip-practice__finger-count',
    textContent: 'Touch with 4+ fingers',
  });

  let gripCount = 0;
  let gripAchieved = false;
  let running = true;
  const activePointers = new Map<number, { x: number; y: number; el: HTMLElement }>();

  // Timer
  const startTime = performance.now();
  const timerInterval = setInterval(() => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / GRIP_PRACTICE_DURATION_MS, 1);
    progressFill.style.width = `${progress * 100}%`;

    if (elapsed >= GRIP_PRACTICE_DURATION_MS) {
      running = false;
      clearInterval(timerInterval);
      showPracticeResults(wrapper, gripCount);
    }
  }, 50);

  const onPointerDown = (e: PointerEvent) => {
    if (!running) return;
    e.preventDefault();

    // Create indicator circle at touch position
    const circle = createElement('div', { className: 'grip-practice__circle' });
    circle.style.left = `${e.clientX - 20}px`;
    circle.style.top = `${e.clientY - 20}px`;
    indicatorContainer.appendChild(circle);

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, el: circle });

    fingerCount.textContent = `${activePointers.size} finger${activePointers.size !== 1 ? 's' : ''}`;

    if (activePointers.size >= GRIP_MIN_FINGERS && !gripAchieved) {
      gripAchieved = true;
      // Turn all circles green
      activePointers.forEach(({ el }) => {
        el.classList.add('grip-practice__circle--grip');
      });
      feedback.textContent = 'Grip!';
      feedback.className = 'grip-practice__feedback grip-practice__feedback--grip';
      if (supportsVibration()) vibrate(10);
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!running) return;

    const pointer = activePointers.get(e.pointerId);
    if (pointer) {
      pointer.el.remove();
      activePointers.delete(e.pointerId);
    }

    fingerCount.textContent = activePointers.size > 0
      ? `${activePointers.size} finger${activePointers.size !== 1 ? 's' : ''}`
      : `Touch with ${GRIP_MIN_FINGERS}+ fingers`;

    if (activePointers.size === 0) {
      if (gripAchieved) {
        gripCount++;
        counter.textContent = String(gripCount);
        feedback.textContent = 'Release! Good!';
        feedback.className = 'grip-practice__feedback grip-practice__feedback--release';
      }
      gripAchieved = false;
    }
  };

  const onPointerCancel = (e: PointerEvent) => {
    onPointerUp(e);
  };

  // Gesture prevention
  practiceArea.style.touchAction = 'none';
  practiceArea.style.userSelect = 'none';
  (practiceArea.style as unknown as Record<string, string>)['-webkit-touch-callout'] = 'none';

  practiceArea.addEventListener('pointerdown', onPointerDown);
  practiceArea.addEventListener('pointerup', onPointerUp);
  practiceArea.addEventListener('pointercancel', onPointerCancel);

  practiceArea.appendChild(progressBar);
  practiceArea.appendChild(counter);
  practiceArea.appendChild(fingerCount);
  practiceArea.appendChild(feedback);
  practiceArea.appendChild(indicatorContainer);
  wrapper.appendChild(practiceArea);
}

function showPracticeResults(wrapper: HTMLElement, gripCount: number): void {
  clearContainer(wrapper);

  const results = createElement('div', { className: 'tapping-practice__results' });
  results.innerHTML = `
    <h2>Great!</h2>
    <p>You completed <strong>${gripCount}</strong> grip/release cycle${gripCount !== 1 ? 's' : ''}.</p>
    <p>Ready for the real test?</p>
  `;

  const practiceAgainBtn = createButton({
    text: 'Practice Again',
    variant: 'secondary',
    fullWidth: true,
    onClick: () => renderGripPractice(wrapper.parentElement ?? wrapper),
  });

  const startBtn = createButton({
    text: 'Start Real Test',
    variant: 'primary',
    fullWidth: true,
    onClick: async () => {
      const profile = await getProfile();
      if (profile) {
        profile.practice_completed = true;
        await saveProfile(profile);
      }
      router.navigate('#/assessment/grip_v1/countdown');
    },
  });

  results.appendChild(practiceAgainBtn);
  results.appendChild(startBtn);
  wrapper.appendChild(results);
}

const style = document.createElement('style');
style.textContent = `
  .grip-practice__area {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--color-bg);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .grip-practice__indicators {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
  .grip-practice__circle {
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-primary);
    opacity: 0.7;
    transition: background-color 100ms ease;
  }
  .grip-practice__circle--grip {
    background: var(--color-success);
  }
  .grip-practice__feedback {
    position: absolute;
    top: 45%;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    min-height: 2rem;
    z-index: 2;
    text-align: center;
  }
  .grip-practice__feedback--grip {
    color: var(--color-success);
  }
  .grip-practice__feedback--release {
    color: var(--color-primary);
  }
  .grip-practice__finger-count {
    position: absolute;
    bottom: var(--space-12);
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    z-index: 2;
  }
`;
document.head.appendChild(style);
