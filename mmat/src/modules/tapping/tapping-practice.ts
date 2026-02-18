import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { vibrate, supportsVibration } from '../../utils/device';
import { PRACTICE_DURATION_MS } from '../../constants';
import { router } from '../../main';

export function renderTappingPractice(container: HTMLElement): void {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'assessment-practice' });
  wrapper.setAttribute('role', 'main');

  const intro = createElement('div', { className: 'assessment-practice__intro' });
  intro.innerHTML = `
    <h1>Practice Round</h1>
    <p>Let's do a quick 5-second practice first. This won't be saved.</p>
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

  const practiceArea = createElement('div', { className: 'assessment-practice__area' });

  // Counter
  const counter = createElement('div', {
    className: 'assessment-practice__counter',
    textContent: '0',
  });

  // Feedback text
  const feedback = createElement('div', {
    className: 'assessment-practice__feedback',
    'aria-live': 'polite',
  });

  // Progress bar
  const progressBar = createElement('div', { className: 'assessment-practice__progress' });
  const progressFill = createElement('div', { className: 'assessment-practice__progress-fill' });
  progressBar.appendChild(progressFill);

  // Target
  const target = createElement('div', { className: 'assessment-practice__target' });
  target.setAttribute('role', 'button');
  target.setAttribute('aria-label', 'Tap target');

  let tapCount = 0;
  let activeTouchId: number | null = null;
  let running = true;

  // Timer
  const startTime = performance.now();
  const timerInterval = setInterval(() => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / PRACTICE_DURATION_MS, 1);
    progressFill.style.width = `${progress * 100}%`;

    if (elapsed >= PRACTICE_DURATION_MS) {
      running = false;
      clearInterval(timerInterval);
      showPracticeResults(wrapper, tapCount);
    }
  }, 50);

  // Touch handlers
  const onPointerDown = (e: PointerEvent) => {
    if (!running) return;
    e.preventDefault();

    if (activeTouchId !== null) {
      // Multi-touch — show rejection feedback
      target.classList.add('assessment-practice__target--invalid');
      feedback.textContent = 'Lift your finger first!';
      setTimeout(() => {
        target.classList.remove('assessment-practice__target--invalid');
      }, 200);
      return;
    }

    activeTouchId = e.pointerId;
    tapCount++;
    counter.textContent = String(tapCount);

    // Valid tap feedback
    target.classList.add('assessment-practice__target--valid');
    feedback.textContent = '';
    if (supportsVibration()) vibrate(10);

    setTimeout(() => {
      target.classList.remove('assessment-practice__target--valid');
    }, 100);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === activeTouchId) {
      activeTouchId = null;
    }
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId === activeTouchId) {
      activeTouchId = null;
    }
  };

  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerCancel);

  // Prevent gestures
  target.style.touchAction = 'none';
  target.style.userSelect = 'none';
  (target.style as unknown as Record<string, string>)['-webkit-touch-callout'] = 'none';

  practiceArea.appendChild(progressBar);
  practiceArea.appendChild(counter);
  practiceArea.appendChild(feedback);
  practiceArea.appendChild(target);
  wrapper.appendChild(practiceArea);
}

function showPracticeResults(wrapper: HTMLElement, tapCount: number): void {
  clearContainer(wrapper);

  const results = createElement('div', { className: 'assessment-practice__results' });
  results.innerHTML = `
    <h2>Great!</h2>
    <p>You tapped <strong>${tapCount}</strong> times.</p>
    <p>Ready for the real test?</p>
  `;

  const practiceAgainBtn = createButton({
    text: 'Practice Again',
    variant: 'secondary',
    fullWidth: true,
    onClick: () => renderTappingPractice(wrapper.parentElement ?? wrapper),
  });

  const backBtn = createButton({
    text: 'Back to Instructions',
    variant: 'primary',
    fullWidth: true,
    onClick: () => router.navigate('#/assessment/tapping_v1/instructions'),
  });

  results.appendChild(practiceAgainBtn);
  results.appendChild(backBtn);
  wrapper.appendChild(results);
}

const style = document.createElement('style');
style.textContent = `
  .assessment-practice__area {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    min-height: 100vh;
    min-height: 100dvh;
    padding: var(--space-4);
    padding-bottom: calc(var(--space-12) + var(--safe-area-bottom));
    position: relative;
  }
  .assessment-practice__feedback {
    position: absolute;
    top: 40%;
    font-size: var(--font-size-base);
    color: var(--color-error);
    font-weight: var(--font-weight-semibold);
    min-height: 1.5rem;
  }
  .assessment-practice__target {
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: var(--color-primary);
    border: 4px solid var(--color-primary-dark);
    cursor: pointer;
    transition: transform 50ms ease;
    margin-bottom: var(--space-8);
  }
  .assessment-practice__target--valid {
    background: var(--color-primary-light);
    transform: scale(0.95);
  }
  .assessment-practice__target--invalid {
    background: var(--color-error);
    border-color: #C62828;
  }
`;
document.head.appendChild(style);
