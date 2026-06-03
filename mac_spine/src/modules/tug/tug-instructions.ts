import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { audioManager } from '../../utils/audio';
import { getProfile } from '../../core/db';
import { router } from '../../main';

export async function renderTugInstructions(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const profile = await getProfile();

  // Auto-navigate to sensor check on first run (if never calibrated)
  if (!profile?.practice_completed) {
    router.navigate('#/assessment/tug_v1/practice');
    return;
  }

  // Auto-navigate to step calibration if not yet done.
  if (!profile?.tug_step_calibration) {
    router.navigate('#/assessment/tug_v1/step_calibration');
    return;
  }

  const wrapper = createElement('main', { className: 'assessment-instructions' });
  wrapper.setAttribute('role', 'main');

  const title = createElement('h1', { textContent: 'Timed Up & Go' });

  const readyBtn = createButton({
    text: "I'm Ready",
    variant: 'primary',
    fullWidth: true,
    onClick: async () => {
      audioManager.initOnGesture();
      const p = await getProfile();
      const audioEnabled = p?.preferences.audio_enabled ?? true;
      audioManager.setEnabled(audioEnabled);
      await audioManager.preloadAll();
      router.navigate('#/assessment/tug_v1/countdown');
    },
  });

  const calibrateBtn = createButton({
    text: 'Sensor Calibration',
    variant: 'secondary',
    fullWidth: true,
    onClick: () => router.navigate('#/assessment/tug_v1/practice'),
  });

  const stepCalBtn = createButton({
    text: 'Re-calibrate Step Detection',
    variant: 'secondary',
    fullWidth: true,
    onClick: () => router.navigate('#/assessment/tug_v1/step_calibration'),
  });

  const soundSection = createElement('div', { className: 'tug-instructions__sound-section' });

  const testSoundBtn = createButton({
    text: 'Test Sound',
    variant: 'secondary',
    fullWidth: true,
    onClick: async () => {
      audioManager.initOnGesture();
      const p = await getProfile();
      const audioEnabled = p?.preferences.audio_enabled ?? true;
      audioManager.setEnabled(audioEnabled);
      await audioManager.preloadAll();
      audioManager.play('beep');
    },
  });

  const volumeNote = createElement('p', {
    className: 'tug-instructions__volume-note',
    textContent: 'Ensure your phone volume is turned up. You will hear a tone at the start, a beep at 3 meters, and a tone when the test ends.',
  });

  soundSection.appendChild(testSoundBtn);
  soundSection.appendChild(volumeNote);

  const divider = createElement('hr', { className: 'tug-instructions__divider' });

  const body = createElement('div', { className: 'assessment-instructions__body' });
  body.innerHTML = '<p>The phone must go in your <strong>front trouser pocket</strong> — the same placement used during step calibration. Holding it in your hand or chest will produce unreliable step detection.</p>';

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
  helperNote.innerHTML = '<p><strong>Note:</strong> Make sure the phone is secure in your pocket. An emergency stop button is always available on screen.</p>';

  const cancelBtn = createButton({
    text: 'Cancel',
    variant: 'text',
    onClick: () => router.navigate('#/menu'),
  });

  wrapper.appendChild(title);
  wrapper.appendChild(readyBtn);
  wrapper.appendChild(calibrateBtn);
  wrapper.appendChild(stepCalBtn);
  wrapper.appendChild(soundSection);
  wrapper.appendChild(cancelBtn);
  wrapper.appendChild(divider);
  wrapper.appendChild(body);
  wrapper.appendChild(steps);
  wrapper.appendChild(helperNote);
  container.appendChild(wrapper);
}

const style = document.createElement('style');
style.textContent = `
  .tug-instructions__sound-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .tug-instructions__volume-note {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    line-height: var(--line-height-relaxed);
    text-align: center;
  }

  .tug-instructions__divider {
    border: none;
    border-top: 2px solid var(--color-secondary);
    margin: var(--space-2) 0;
  }

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
`;
document.head.appendChild(style);
