import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { vibrate, supportsVibration } from '../../utils/device';
import { getProfile, saveProfile } from '../../core/db';
import { router } from '../../main';

export function renderTugPractice(container: HTMLElement): void {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'assessment-practice' });
  wrapper.setAttribute('role', 'main');

  const intro = createElement('div', { className: 'assessment-practice__intro' });
  intro.innerHTML = `
    <h1>Practice Round</h1>
    <p>Let\u2019s do a quick practice to learn the controls. This won\u2019t be saved.</p>
    <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
      Tap Start to begin the timer, then tap Stop to end it.
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

  const practiceArea = createElement('div', { className: 'tug-practice__area' });

  const banner = createElement('div', {
    className: 'tug-practice__banner',
    textContent: 'Practice Round',
  });

  const timerDisplay = createElement('div', {
    className: 'tug-practice__timer',
    textContent: '00:00.0',
  });

  const stopBtn = createButton({
    text: 'STOP',
    variant: 'primary',
    fullWidth: true,
    onClick: () => {
      if (!running) return;
      running = false;
      clearInterval(timerInterval);
      const elapsed = performance.now() - startTime;
      const timeS = (elapsed / 1000).toFixed(1);
      showPracticeResults(wrapper, timeS);
    },
  });
  stopBtn.classList.add('tug-practice__stop-btn');

  let running = true;
  const startTime = performance.now();

  if (supportsVibration()) vibrate(30);

  const timerInterval = setInterval(() => {
    if (!running) return;
    const elapsed = performance.now() - startTime;
    timerDisplay.textContent = formatTime(elapsed);
  }, 100);

  practiceArea.appendChild(banner);
  practiceArea.appendChild(timerDisplay);
  practiceArea.appendChild(stopBtn);
  wrapper.appendChild(practiceArea);
}

function showPracticeResults(wrapper: HTMLElement, timeS: string): void {
  clearContainer(wrapper);

  const results = createElement('div', { className: 'assessment-practice__results' });
  results.innerHTML = `
    <h2>Great!</h2>
    <p>Your practice time: <strong>${timeS}s</strong></p>
    <p>Ready for the real test?</p>
  `;

  const practiceAgainBtn = createButton({
    text: 'Practice Again',
    variant: 'secondary',
    fullWidth: true,
    onClick: () => renderTugPractice(wrapper.parentElement ?? wrapper),
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
      router.navigate('#/assessment/tug_v1/countdown');
    },
  });

  results.appendChild(practiceAgainBtn);
  results.appendChild(startBtn);
  wrapper.appendChild(results);
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds * 10) % 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

const style = document.createElement('style');
style.textContent = `
  .tug-practice__area {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    min-height: 100vh;
    min-height: 100dvh;
    padding: var(--space-4);
  }
  .tug-practice__banner {
    background: var(--color-primary);
    color: #fff;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
  }
  .tug-practice__timer {
    font-size: var(--font-size-4xl);
    font-weight: var(--font-weight-bold);
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }
  .tug-practice__stop-btn {
    max-width: 16rem;
  }
`;
document.head.appendChild(style);
