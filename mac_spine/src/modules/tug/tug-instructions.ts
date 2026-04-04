import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { audioManager } from '../../utils/audio';
import { getProfile, saveProfile } from '../../core/db';
import { router } from '../../main';
import type { TugPhoneMode } from './tug-types';

function getModeContent(mode: TugPhoneMode): { intro: string; steps: string; helperNote: string } {
  if (mode === 'hand') {
    return {
      intro: 'Hold the phone at your sternum and it will automatically detect each phase:',
      steps: `
        <ol class="tug-instructions__steps">
          <li>Hold the phone flat against your <strong>sternum (breastbone)</strong>, screen facing you</li>
          <li>Sit in a chair with your back against the chair</li>
          <li>Sit still &mdash; the test starts automatically after 3 seconds</li>
          <li>When you hear the start tone, stand up and walk forward</li>
          <li>You will hear a beep at 3 meters &mdash; turn around and walk back to the chair</li>
          <li>Sit down and remain still &mdash; an end tone will mark the end of the test</li>
        </ol>
      `,
      helperNote: 'Keep the phone stable and flat against your chest throughout the test. An emergency stop button is always available on screen.',
    };
  }
  return {
    intro: 'The phone will go in your pocket and automatically detect each phase:',
    steps: `
      <ol class="tug-instructions__steps">
        <li><strong>Do not turn off the screen</strong> &mdash; place the phone in your front trouser pocket with the screen on</li>
        <li>Sit in a chair with your back against the chair</li>
        <li>Sit still &mdash; the test starts automatically after 3 seconds</li>
        <li>When you hear the start tone, stand up and walk forward</li>
        <li>You will hear a beep at 3 meters &mdash; turn around and walk back to the chair</li>
        <li>Sit down and remain still &mdash; an end tone will mark the end of the test</li>
      </ol>
    `,
    helperNote: 'Make sure the phone is secure in your pocket. An emergency stop button is always available on screen.',
  };
}

export async function renderTugInstructions(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const profile = await getProfile();

  // Auto-navigate to sensor check on first run (if never calibrated)
  if (!profile?.practice_completed) {
    router.navigate('#/assessment/tug_v1/practice');
    return;
  }

  let currentMode: TugPhoneMode = profile?.preferences.tug_phone_mode ?? 'pocket';

  const wrapper = createElement('main', { className: 'assessment-instructions' });
  wrapper.setAttribute('role', 'main');

  const title = createElement('h1', { textContent: 'Timed Up & Go' });

  // Mode selector
  const modeGroup = createElement('div', { className: 'tug-instructions__mode-group' });
  modeGroup.setAttribute('role', 'radiogroup');
  modeGroup.setAttribute('aria-label', 'Phone placement during test');

  const modes: { value: TugPhoneMode; label: string }[] = [
    { value: 'pocket', label: 'Phone in Pocket' },
    { value: 'hand', label: 'Phone in Hand' },
  ];

  const modeBtns: HTMLButtonElement[] = [];

  async function saveMode(mode: TugPhoneMode): Promise<void> {
    const p = await getProfile();
    if (!p) return;
    p.preferences.tug_phone_mode = mode;
    p.updated_at = new Date().toISOString();
    await saveProfile(p);
  }

  for (const m of modes) {
    const btn = createElement('button', {
      className: 'assessment-setup__hand-btn' + (m.value === currentMode ? ' assessment-setup__hand-btn--active' : ''),
      textContent: m.label,
    }) as HTMLButtonElement;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', m.value === currentMode ? 'true' : 'false');

    btn.addEventListener('click', async () => {
      if (currentMode === m.value) return;
      currentMode = m.value;
      modeBtns.forEach((b, i) => {
        const isActive = modes[i].value === currentMode;
        b.classList.toggle('assessment-setup__hand-btn--active', isActive);
        b.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
      updateContent();
      await saveMode(currentMode);
    });

    modeBtns.push(btn);
    modeGroup.appendChild(btn);
  }

  const body = createElement('div', { className: 'assessment-instructions__body' });

  const steps = createElement('div', { className: 'assessment-instructions__important' });

  const helperNote = createElement('div', { className: 'tug-instructions__helper-note' });

  function updateContent(): void {
    const content = getModeContent(currentMode);
    body.innerHTML = `<p>${content.intro}</p>`;
    steps.innerHTML = content.steps;
    helperNote.innerHTML = `<p><strong>Note:</strong> ${content.helperNote}</p>`;
  }

  updateContent();

  // Sound reminder + test button
  const soundNote = createElement('div', { className: 'tug-instructions__sound-note' });
  soundNote.innerHTML = `<p>Ensure your phone volume is turned up. You will hear a tone at the start, a beep at 3 meters, and a tone when the test ends.</p>`;

  const testSoundBtn = createButton({
    text: 'Test Sound',
    variant: 'secondary',
    onClick: async () => {
      audioManager.initOnGesture();
      const p = await getProfile();
      const audioEnabled = p?.preferences.audio_enabled ?? true;
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

  const actions = createElement('div', { className: 'assessment-instructions__actions' });
  actions.appendChild(readyBtn);

  const cancelBtn = createButton({
    text: 'Cancel',
    variant: 'text',
    onClick: () => router.navigate('#/menu'),
  });

  wrapper.appendChild(title);
  wrapper.appendChild(modeGroup);
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
  .tug-instructions__mode-group {
    display: flex;
    gap: var(--space-2);
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
