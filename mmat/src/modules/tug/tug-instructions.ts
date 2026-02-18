import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { audioManager } from '../../utils/audio';
import { getProfile, getResultsByTaskPrefix } from '../../core/db';
import { router } from '../../main';

export async function renderTugInstructions(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'assessment-instructions' });
  wrapper.setAttribute('role', 'main');

  const title = createElement('h1', { textContent: 'Timed Up & Go' });

  const body = createElement('div', { className: 'assessment-instructions__body' });
  body.innerHTML = `<p>The phone will go in your pocket and automatically detect each phase:</p>`;

  const steps = createElement('div', { className: 'assessment-instructions__important' });
  steps.innerHTML = `
    <ol class="tug-instructions__steps">
      <li><strong>Do not turn off the screen</strong> &mdash; place the phone in your front trouser pocket with the screen on</li>
      <li>Sit in a chair with your back against the chair</li>
      <li>Sit still &mdash; the test starts automatically after 3 seconds</li>
      <li>When you hear the start tone, stand up and walk forward</li>
      <li>You will hear a beep at 3 meters &mdash; turn around and walk back to the chair</li>
      <li>Sit down and remain still &mdash; an end tone will mark the end of the test</li>
    </ol>
  `;

  const helperNote = createElement('div', { className: 'tug-instructions__helper-note' });
  helperNote.innerHTML = `<p><strong>Note:</strong> Make sure the phone is secure in your pocket. An emergency stop button is always available on screen.</p>`;

  // Sound reminder + test button
  const soundNote = createElement('div', { className: 'tug-instructions__sound-note' });
  soundNote.innerHTML = `<p>Ensure your phone volume is turned up. You will hear a tone at the start, a beep at 3 meters, and a tone when the test ends.</p>`;

  const testSoundBtn = createButton({
    text: 'Test Sound',
    variant: 'secondary',
    onClick: async () => {
      audioManager.initOnGesture();
      const profile = await getProfile();
      const audioEnabled = profile?.preferences.audio_enabled ?? true;
      audioManager.setEnabled(audioEnabled);
      await audioManager.preloadAll();
      audioManager.play('beep');
    },
  });
  soundNote.appendChild(testSoundBtn);

  // Sensor calibration
  const calibrateBtn = createButton({
    text: 'Sensor Calibration',
    variant: 'secondary',
    fullWidth: true,
    onClick: () => router.navigate('#/assessment/tug_v1/practice'),
  });

  // Auto-navigate to sensor check on first run
  const tugResults = await getResultsByTaskPrefix('tug');
  if (tugResults.length === 0) {
    router.navigate('#/assessment/tug_v1/practice');
    return;
  }

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
      router.navigate('#/assessment/tug_v1/countdown');
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
  wrapper.appendChild(steps);
  wrapper.appendChild(helperNote);
  wrapper.appendChild(soundNote);
  wrapper.appendChild(calibrateBtn);
  wrapper.appendChild(actions);
  wrapper.appendChild(cancelBtn);
  container.appendChild(wrapper);
}

const style = document.createElement('style');
style.textContent = `
  .tug-instructions__steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    counter-reset: step;
  }
  .tug-instructions__steps li {
    position: relative;
    padding-left: var(--space-6);
    font-size: var(--font-size-base);
    line-height: var(--line-height-relaxed);
  }
  .tug-instructions__steps li::before {
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
  .tug-instructions__helper-note {
    background: var(--color-bg-secondary);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    line-height: var(--line-height-relaxed);
  }
  .tug-instructions__helper-note p {
    margin: 0;
    font-size: var(--font-size-base);
  }
  .tug-instructions__sound-note {
    background: var(--color-bg-secondary);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: center;
  }
  .tug-instructions__sound-note p {
    margin: 0;
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
  }
`;
document.head.appendChild(style);
